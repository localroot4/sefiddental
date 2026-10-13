import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { fa } from '@payloadcms/translations/languages/fa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { payloadTotp } from 'payload-totp';
import sharp from 'sharp';

import { Media } from './collections/Media';
import { Users } from './collections/Users';
import { readEnv } from './lib/env';
import { databaseAdapter } from './payload/db';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const env = readEnv();

const MiB = 1024 * 1024;

export default buildConfig({
  serverURL: env.siteUrl,
  secret: env.payloadSecret,
  // Defaults that call third-party hosts (slow or blocked from Iran) are off.
  telemetry: false,
  graphQL: { disable: true },
  admin: {
    user: Users.slug,
    avatar: 'default',
    meta: {
      // Payload inserts the space before the suffix (next/dist/utilities/meta.js).
      titleSuffix: '| پنل کلینیک سفید',
      defaultOGImageType: 'off',
      robots: 'noindex, nofollow',
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/brand/favicon.svg' }],
      // Replaces Payload's English defaults ("Payload App").
      openGraph: { siteName: 'پنل کلینیک سفید', description: 'پنل مدیریت کلینیک دندانپزشکی سفید' },
    },
    // Component paths in the config are relative to src/, e.g. '/admin/views/SystemStatus#X'.
    importMap: { baseDir: srcDir },
    timezones: {
      supportedTimezones: [{ label: 'تهران', value: 'Asia/Tehran' }],
      defaultTimezone: 'Asia/Tehran',
    },
  },
  i18n: { supportedLanguages: { fa }, fallbackLanguage: 'fa' },
  collections: [Users, Media],
  editor: lexicalEditor(),
  db: databaseAdapter(srcDir),
  sharp,
  typescript: { outputFile: path.resolve(srcDir, 'payload-types.ts') },
  // Temp files keep large uploads out of RAM; per-type limits live on the media collection.
  upload: { useTempFiles: true, limits: { fileSize: 60 * MiB }, requestSizeLimit: 64 * MiB },
  // Password-reset mail: SMTP when configured, else Payload logs the message.
  ...(env.smtp
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: env.smtp.from,
          defaultFromName: 'کلینیک دندانپزشکی سفید',
          transportOptions: {
            host: env.smtp.host,
            port: env.smtp.port,
            secure: env.smtp.port === 465,
            auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
          },
        }),
      }
    : {}),
  plugins: [
    s3Storage({
      enabled: env.s3 !== null,
      alwaysInsertFields: true,
      collections: { media: true },
      bucket: env.s3?.bucket ?? '',
      config: {
        endpoint: env.s3?.endpoint,
        region: env.s3?.region ?? 'default',
        forcePathStyle: env.s3?.forcePathStyle ?? false,
        credentials: {
          accessKeyId: env.s3?.accessKeyId ?? '',
          secretAccessKey: env.s3?.secretAccessKey ?? '',
        },
      },
    }),
    // Must stay last: it wraps the access of every collection and global present when it runs.
    payloadTotp({ collection: 'users', forceSetup: true, totp: { issuer: 'Sefid Dental' } }),
  ],
});
