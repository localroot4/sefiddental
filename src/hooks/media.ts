import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload';
import { APIError } from 'payload';
import sharp, { type Metadata } from 'sharp';

import { persianSlug } from '@/lib/persianSlug';

import { ctx } from './context';

/** H-MEDIA (spec-data 7.3-7.5): limits with Persian messages, content-hashed names, LQIP. */

const MiB = 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
export const MAX_PIXELS = 50_000_000;

export const MEDIA_MESSAGES = {
  imageSize: 'حجم عکس بیشتر از ۲۰ مگابایت است. عکس کوچک‌تری بفرستید.',
  videoSize: 'حجم ویدیو بیشتر از ۶۰ مگابایت است. ویدیو را فشرده کنید.',
  type: 'این نوع فایل پذیرفته نمی‌شود. فقط JPEG، PNG، WebP، AVIF، MP4 و WebM.',
  pixels: 'ابعاد عکس بیش از حد بزرگ است (بیش از ۵۰ مگاپیکسل). نسخهٔ کوچک‌تری بفرستید.',
  tooSmall: 'عکس خیلی کوچک است؛ دست‌کم ۳۲۰ پیکسل.',
  replace:
    'فایل یا برش یک رسانهٔ ذخیره‌شده عوض نمی‌شود. یک رسانهٔ تازه بسازید و آن را جایگزین کنید.',
  missing: 'فایلی فرستاده نشد. فایل را از دستگاه خود بارگذاری کنید.',
  location:
    'ویدیو موقعیت مکانی دارد. پیش از بارگذاری، موقعیت را از فایل حذف کنید (در گوشی: اشتراک بدون موقعیت).',
} as const;

type UploadedFile = NonNullable<PayloadRequest['file']> & { tempFilePath?: string };

const reject = (message: string): never => {
  throw new APIError(message, 400, null, true);
};

/** Pure checks on the claimed type, the size and the decoded dimensions. */
export function mediaProblem(file: {
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
}): string | null {
  const isImage = (IMAGE_TYPES as readonly string[]).includes(file.mimetype);
  const isVideo = (VIDEO_TYPES as readonly string[]).includes(file.mimetype);
  if (!isImage && !isVideo) return MEDIA_MESSAGES.type;
  if (isImage && file.size > 20 * MiB) return MEDIA_MESSAGES.imageSize;
  if (isVideo && file.size > 60 * MiB) return MEDIA_MESSAGES.videoSize;
  if (isImage && file.width && file.height) {
    if (file.width * file.height > MAX_PIXELS) return MEDIA_MESSAGES.pixels;
    if (Math.max(file.width, file.height) < 320) return MEDIA_MESSAGES.tooSmall;
  }
  return null;
}

async function sha256Of(file: UploadedFile): Promise<string> {
  const hash = createHash('sha256');
  if (file.tempFilePath && (!file.data || file.data.length === 0)) {
    for await (const chunk of createReadStream(file.tempFilePath)) hash.update(chunk as Buffer);
  } else {
    hash.update(file.data);
  }
  return hash.digest('hex');
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** '{persianSlug(base) || file}-{sha256[0..10]}.{ext}': a replaced file never reuses a URL. */
export function hashedName(original: string, mimetype: string, sha256: string): string {
  const ext = path.extname(original).slice(1).toLowerCase() || EXT_BY_TYPE[mimetype] || 'bin';
  const base =
    persianSlug(path.basename(original, path.extname(original)), { maxLength: 60 }) || 'file';
  return `${base}-${sha256.slice(0, 10)}.${ext}`;
}

/** Image formats sharp may report for an accepted image type (AVIF is HEIF with AV1). */
function isAcceptedImage(meta: Metadata | null): boolean {
  if (!meta?.format) return false;
  if (meta.format === 'heif') return meta.compression === 'av1';
  return meta.format === 'jpeg' || meta.format === 'png' || meta.format === 'webp';
}

/** Reads `length` bytes at `position` of the upload (temp file or buffer). */
type ByteReader = (position: number, length: number) => Promise<Buffer>;

async function withReader<T>(
  file: UploadedFile,
  scan: (read: ByteReader, size: number) => Promise<T>,
) {
  if (!file.tempFilePath || (file.data && file.data.length > 0)) {
    return scan(
      async (position, length) => file.data.subarray(position, position + length),
      file.data.length,
    );
  }
  const handle = await open(file.tempFilePath, 'r');
  try {
    const { size } = await handle.stat();
    return await scan(async (position, length) => {
      const buffer = Buffer.alloc(Math.max(0, Math.min(length, size - position)));
      await handle.read(buffer, 0, buffer.length, position);
      return buffer;
    }, size);
  } finally {
    await handle.close();
  }
}

// MP4 location boxes (searched inside `moov` only: four bytes alone appear in any video stream)
// and keys long enough to search the whole file.
const MOOV_LOCATION = [Buffer.from([0xa9, 0x78, 0x79, 0x7a]), Buffer.from('loci')];
const FILE_LOCATION = [Buffer.from('com.apple.quicktime.location'), Buffer.from('LOCATION')];
const MAX_MOOV = 32 * MiB;
const CHUNK = 1 * MiB;

/**
 * True when a video carries where it was recorded (UP-10): MP4 `©xyz` or `loci` in the movie
 * box, Apple's ISO 6709 key, or a Matroska/WebM LOCATION tag. Videos are stored byte for byte
 * (no ffmpeg at run time), so such a file is refused instead of cleaned.
 */
export async function videoHasLocation(file: UploadedFile): Promise<boolean> {
  return withReader(file, async (read, size) => {
    let offset = 0;
    while (offset + 8 <= size) {
      const head = await read(offset, 16);
      const size32 = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      const box =
        size32 === 1 ? Number(head.readBigUInt64BE(8)) : size32 === 0 ? size - offset : size32;
      if (box < 8) break;
      if (type === 'moov') {
        const moov = await read(offset, Math.min(box, MAX_MOOV));
        if (MOOV_LOCATION.some((needle) => moov.includes(needle))) return true;
      }
      offset += box;
    }
    const overlap = Math.max(...FILE_LOCATION.map((needle) => needle.length)) - 1;
    for (let position = 0; position < size; position += CHUNK) {
      const chunk = await read(Math.max(0, position - overlap), CHUNK + overlap);
      if (FILE_LOCATION.some((needle) => chunk.includes(needle))) return true;
    }
    return false;
  });
}

/** Payload re-cuts the stored original for these edits and overwrites it in place. */
function isCropEdit(req: PayloadRequest): boolean {
  const edits = (req.query as { uploadEdits?: Record<string, unknown> } | undefined)?.uploadEdits;
  return Boolean(edits && (edits.crop || edits.heightInPixels || edits.widthInPixels));
}

export const checkAndRenameUpload: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') return args;
  // Payload deletes the stored original and every size before it validates the save, so a
  // failed save left the document pointing at deleted files (UP-1, UP-9). A new file is a new
  // media document.
  // The seeder's `sync` mode (development only) still swaps a repository file in place.
  const replacing = operation === 'update' && (req.file || isCropEdit(req));
  if (replacing && !ctx(req).seeding) reject(MEDIA_MESSAGES.replace);
  if (!req.file) {
    // A create without a file would make Payload fetch `data.url` from any host, unchecked and
    // unbounded (UP-4); duplicating an existing document keeps working.
    const duplicating = Boolean((args as { duplicateFromID?: unknown }).duplicateFromID);
    if (operation === 'create' && !duplicating) reject(MEDIA_MESSAGES.missing);
    return args;
  }
  const file = req.file as UploadedFile;
  const claimsImage = (IMAGE_TYPES as readonly string[]).includes(file.mimetype);
  // Header only, on every upload: the bytes decide the kind, not the claimed type (UP-7). No
  // pixel decode, so a decompression bomb costs nothing here.
  const meta = await sharp(file.tempFilePath ?? file.data, { limitInputPixels: false })
    .metadata()
    .catch(() => null);
  if (claimsImage !== Boolean(meta?.format) || (claimsImage && !isAcceptedImage(meta))) {
    reject(MEDIA_MESSAGES.type);
  }
  const problem = mediaProblem({
    mimetype: file.mimetype,
    size: file.size,
    width: meta?.width,
    height: meta?.height,
  });
  if (problem) reject(problem);
  if (!claimsImage && (await videoHasLocation(file))) reject(MEDIA_MESSAGES.location);
  file.name = hashedName(file.name, file.mimetype, await sha256Of(file));
  return args;
};

async function lqip(input: Buffer | string): Promise<string> {
  const buffer = await sharp(input)
    .rotate()
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

/**
 * Blur placeholders from the uploaded original and from the 4:5 crop `p640`, which Payload has
 * already generated into `req.payloadUploadSizes` when this hook runs (create.js runs
 * generateFileData before the hooks). A focal-point change regenerates the crop, so the portrait
 * placeholder is recomputed whenever the buffer is there.
 */
export const blurPlaceholders: CollectionBeforeChangeHook = async ({ data, req }) => {
  const out = { ...data };
  const file = req.file as UploadedFile | undefined;
  try {
    if (file && (IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      out.blurDataURL = await lqip(file.tempFilePath ?? file.data);
    }
    const portrait = req.payloadUploadSizes?.p640;
    if (portrait) out.blurDataURLPortrait = await lqip(portrait);
  } catch {
    // A placeholder is optional; the upload itself must not fail for it.
  }
  return out;
};

/** Seven days: crops regenerate in place under the same name when the focal point moves. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=604800';
