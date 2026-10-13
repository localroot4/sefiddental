import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload';
import { APIError } from 'payload';
import sharp from 'sharp';

import { persianSlug } from '@/lib/persianSlug';

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

export const checkAndRenameUpload: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) return args;
  const file = req.file as UploadedFile;
  let width: number | undefined;
  let height: number | undefined;
  if ((IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
    try {
      // Header only: no pixel decode, so a decompression bomb costs nothing here.
      const meta = await sharp(file.tempFilePath ?? file.data, {
        limitInputPixels: false,
      }).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      // Not a readable image: Payload's byte check rejects it with its own message.
    }
  }
  const problem = mediaProblem({ mimetype: file.mimetype, size: file.size, width, height });
  if (problem) reject(problem);
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
