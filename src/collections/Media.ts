import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Access, CollectionConfig, UploadConfig } from 'payload';

import { hasRole, isStaff } from '../access/roles';
import { readEnv } from '../lib/env';

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

/**
 * Skeleton of the media collection: the data lane replaces it with the full pipeline
 * (AVIF and WebP sizes, focal crops, blur placeholders, content-hashed names, video).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'رسانه', plural: 'رسانه‌ها' },
  admin: { group: 'محتوا', useAsTitle: 'alt' },
  access: {
    read: readFilesOrStaff,
    create: isStaff,
    update: isStaff,
    delete: ({ req }) => hasRole(req.user, 'admin'),
  },
  // payload-totp wraps every access function; anonymous file reads must stay open.
  custom: { totp: { disableAccessWrapper: { read: true } } },
  upload: {
    staticDir: readEnv().mediaDir,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    pasteURL: false,
    focalPoint: true,
    handlers: [missingLocalFileIs404 as FileHandler],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'متن جایگزین',
      required: true,
      maxLength: 160,
    },
  ],
};
