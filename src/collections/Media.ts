import { stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  Access,
  CollectionConfig,
  Endpoint,
  ImageSize,
  PayloadRequest,
  UploadConfig,
} from 'payload';

import { hasRole, isStaff } from '@/access/roles';
import { contentHooks } from '@/hooks/compose';
import {
  blurPlaceholders,
  checkAndRenameUpload,
  MAX_PIXELS,
  MEDIA_CACHE_CONTROL,
  MEDIA_TYPES,
} from '@/hooks/media';
import { readEnv } from '@/lib/env';

// Files are public (the site embeds them); documents and the REST list are staff-only.
const readFilesOrStaff: Access = ({ req, isReadingStaticFile }) =>
  Boolean(isReadingStaticFile) || hasRole(req.user, 'admin', 'editor');

// Editors change live media only: a trashed document is the admin's to restore or delete (UP-9;
// Payload checks delete access for a move to the trash, never for a restore).
const updateLiveOrAdmin: Access = ({ req }) =>
  hasRole(req.user, 'admin') || (hasRole(req.user, 'editor') && { deletedAt: { exists: false } });

const notFound = () => Response.json({ errors: [{ message: 'Not Found' }] }, { status: 404 });

/**
 * Files of a trashed document stop being public (UP-3): Payload serves every file in staticDir
 * or the bucket once read access is true, and the trash keeps the files. Staff still see them in
 * the trash view. A name no file system takes (NUL, over 255 bytes) is a 404 before any lookup.
 */
export async function trashedFileIs404(
  req: Pick<PayloadRequest, 'payload' | 'user'>,
  { params }: { params: { filename: string } },
): Promise<Response | undefined> {
  const name = params.filename;
  if (name.includes('\0') || Buffer.byteLength(name) > 255) return notFound();
  if (hasRole(req.user, 'admin', 'editor')) return undefined;
  const trashed = await req.payload.db.findOne({
    collection: 'media',
    where: {
      and: [
        { deletedAt: { exists: true } },
        {
          or: [
            { filename: { equals: name } },
            ...IMAGE_SIZES.map(({ name: size }) => ({
              [`sizes.${size}.filename`]: { equals: name },
            })),
          ],
        },
      ],
    },
  });
  return trashed ? notFound() : undefined;
}

/**
 * Payload answers a file missing from the local disk with 500 and an ERROR log line
 * (payload/dist/uploads/endpoints/getFile.js). A stale link or a bot probe is a plain 404.
 * Handlers run before Payload's disk fallback; with S3 the storage plugin's handler serves files.
 */
export async function missingLocalFileIs404(
  _req: unknown,
  { params }: { params: { filename: string } },
): Promise<Response | undefined> {
  const env = readEnv();
  if (env.s3) return;
  const dir = path.resolve(env.mediaDir);
  const file = path.resolve(dir, params.filename);
  if (!file.startsWith(dir + path.sep)) return; // Payload rejects it with 400
  try {
    await stat(file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Too long or NUL in the name: a probe, not a server fault (UP-11).
    if (['ENOENT', 'ENOTDIR', 'ENAMETOOLONG', 'ERR_INVALID_ARG_VALUE'].includes(code ?? '')) {
      return notFound();
    }
    // Any other error: Payload's fallback stats again, throws and logs it.
  }
  return undefined;
}

// Payload types a handler's result as Promise<Response> | Promise<void>; it checks
// `instanceof Response` at run time, so Promise<Response | undefined> is safe.
type FileHandler = NonNullable<UploadConfig['handlers']>[number];

/**
 * HEAD of a media file (UP-13): Payload registers the file route for GET only, so link checkers
 * and preview bots got 404. Runs Payload's own GET (access, handlers, storage) without the body.
 */
const headFile: Endpoint = {
  path: '/file/:filename',
  method: 'head',
  handler: async (req) => {
    const get = req.payload.collections.media.config.endpoints;
    const fileGet = Array.isArray(get)
      ? get.find((e) => e.method === 'get' && e.path === '/file/:filename')
      : undefined;
    if (!fileGet) return notFound();
    const response = await fileGet.handler(req);
    await response.body?.cancel();
    return new Response(null, { status: response.status, headers: response.headers });
  },
};

const webp = { format: 'webp' as const, options: { quality: 75, effort: 4 } };
const avif = { format: 'avif' as const, options: { quality: 50, effort: 4 } };
const listHidden = { disableListColumn: true, disableListFilter: true };

/** Every size but `thumb` twice: WebP under its name, AVIF under name + 'Avif' (spec-data 7.2). */
const pair = (name: string, size: Omit<ImageSize, 'name' | 'formatOptions'>): ImageSize[] => [
  { name, ...size, formatOptions: webp, admin: listHidden },
  { name: `${name}Avif`, ...size, formatOptions: avif, admin: listHidden },
];

export const IMAGE_SIZES: ImageSize[] = [
  { name: 'thumb', width: 320, formatOptions: webp, admin: listHidden },
  ...[640, 960, 1280, 1600, 1920, 2560].flatMap((width) => pair(`w${width}`, { width })),
  // 4:5 and 1:1 crops around the focal point.
  ...pair('p640', { width: 640, height: 800 }),
  ...pair('p828', { width: 828, height: 1035 }),
  ...pair('p1080', { width: 1080, height: 1350 }),
  ...pair('s640', { width: 640, height: 640 }),
  ...pair('s1080', { width: 1080, height: 1080 }),
];

/**
 * spec-data 2.15 and 7: the original keeps its format (PNG keeps alpha) but is re-encoded by
 * the resize cap, which drops an image's EXIF and GPS; AVIF and WebP sizes; content-hashed file
 * names; blur placeholders; Persian limits. Videos are stored byte for byte, so one that carries a
 * recording location is refused. A stored file is never replaced: a new file is a new document.
 * Files are public, documents and the REST list staff-only.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'رسانه', plural: 'رسانه‌ها' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'mimeType', 'width', 'height', 'updatedAt'],
    listSearchableFields: ['alt', 'filename'],
    description:
      'عکس‌ها را JPEG بفرستید (عکس HEIC آیفون پذیرفته نمی‌شود). حداکثر ۲۰ مگابایت برای عکس و ۶۰ مگابایت برای ویدیو. ویدیو پاک‌سازی نمی‌شود: ویدیوی دارای موقعیت مکانی پذیرفته نمی‌شود. برای فایل تازه، رسانهٔ تازه بسازید.',
  },
  defaultSort: '-createdAt',
  trash: true,
  defaultPopulate: {
    alt: true,
    url: true,
    width: true,
    height: true,
    mimeType: true,
    focalX: true,
    focalY: true,
    sizes: true,
    blurDataURL: true,
    blurDataURLPortrait: true,
  },
  access: {
    read: readFilesOrStaff,
    create: isStaff,
    update: updateLiveOrAdmin,
    delete: ({ req }) => hasRole(req.user, 'admin'),
  },
  endpoints: [headFile],
  // payload-totp wraps every access function; anonymous file reads must stay open.
  custom: { totp: { disableAccessWrapper: { read: true } } },
  hooks: {
    beforeOperation: [checkAndRenameUpload],
    ...contentHooks('media', {
      normalize: { prose: ['alt', 'caption'], names: ['credit'] },
      beforeChange: [blurPlaceholders],
    }),
  },
  upload: {
    staticDir: readEnv().mediaDir,
    mimeTypes: [...MEDIA_TYPES],
    // The cap forces a sharp re-encode of an image original (EXIF and GPS dropped, format kept).
    resizeOptions: { width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true },
    constructorOptions: { limitInputPixels: MAX_PIXELS },
    imageSizes: IMAGE_SIZES,
    adminThumbnail: 'thumb',
    focalPoint: true,
    crop: true,
    pasteURL: false,
    handlers: [trashedFileIs404 as FileHandler, missingLocalFileIs404 as FileHandler],
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', MEDIA_CACHE_CONTROL);
      return headers;
    },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'متن جایگزین',
      required: true,
      minLength: 3,
      maxLength: 160,
      admin: {
        description:
          'متن جایگزین: آنچه در تصویر دیده می‌شود، به فارسی و کوتاه. برای ویدیو، عنوان ویدیو.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'زیرنویس',
      maxLength: 200,
      admin: { description: 'زیرنویس زیر تصویر، اگر لازم است.' },
    },
    {
      name: 'credit',
      type: 'text',
      label: 'منبع',
      maxLength: 80,
      admin: { description: 'نام عکاس یا منبع.' },
    },
    {
      name: 'blurDataURL',
      type: 'text',
      label: 'پیش‌نمایش محو',
      admin: {
        readOnly: true,
        disableListColumn: true,
        description: 'پیش‌نمایش محو، خودکار ساخته می‌شود.',
      },
    },
    {
      name: 'blurDataURLPortrait',
      type: 'text',
      label: 'پیش‌نمایش محو ۴:۵',
      admin: { readOnly: true, disableListColumn: true, description: 'پیش‌نمایش محو برش ۴:۵.' },
    },
    { name: 'seedSource', type: 'text', unique: true, admin: { hidden: true } },
  ],
};
