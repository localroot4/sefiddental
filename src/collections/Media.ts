import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Access, CollectionConfig, ImageSize, UploadConfig } from 'payload';

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
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return Response.json({ errors: [{ message: 'Not Found' }] }, { status: 404 });
    }
    // Any other error: Payload's fallback stats again, throws and logs it.
  }
  return undefined;
}

// Payload types a handler's result as Promise<Response> | Promise<void>; it checks
// `instanceof Response` at run time, so Promise<Response | undefined> is safe.
type FileHandler = NonNullable<UploadConfig['handlers']>[number];

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
 * the resize cap, which drops EXIF and GPS; AVIF and WebP sizes; content-hashed file names;
 * blur placeholders; Persian limits. Files are public, documents and the REST list staff-only.
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
      'عکس‌ها را JPEG بفرستید (عکس HEIC آیفون پذیرفته نمی‌شود). حداکثر ۲۰ مگابایت برای عکس و ۶۰ مگابایت برای ویدیو.',
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
    update: isStaff,
    delete: ({ req }) => hasRole(req.user, 'admin'),
  },
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
    // The cap forces a sharp re-encode of the original (EXIF and GPS dropped, format kept).
    resizeOptions: { width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true },
    constructorOptions: { limitInputPixels: MAX_PIXELS },
    imageSizes: IMAGE_SIZES,
    adminThumbnail: 'thumb',
    focalPoint: true,
    crop: true,
    pasteURL: false,
    handlers: [missingLocalFileIs404 as FileHandler],
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
