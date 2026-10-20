import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { s3Storage } from '@payloadcms/storage-s3';
import { fa } from '@payloadcms/translations/languages/fa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { payloadTotp } from 'payload-totp';

import { canRunJobs } from './access/jobs';
import { withScheduleBlockMessages } from './admin/schedulePublish';
import { collections } from './collections';
import { richTextEditor } from './fields/richText';
import { globals } from './globals';
import { keepValidationDetails } from './hooks/errors';
import { adminText, PAYLOAD_FA_OVERRIDES } from './i18n/fa-admin';
import { readEnv } from './lib/env';
import { log } from './lib/log/logger';
import { setErrorAlertSink } from './lib/log/requestError';
import { limitedSharp } from './lib/media/limitedSharp';
import { notifier } from './lib/notify';
import { notifyTask } from './lib/notify/task';
import { databaseAdapter, logPoolErrors } from './payload/db';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const env = readEnv();

const MiB = 1024 * 1024;

export default buildConfig({
  serverURL: env.siteUrl,
  secret: env.payloadSecret,
  // Defaults that call third-party hosts (slow or blocked from Iran) are off.
  telemetry: false,
  // The site's pino logger: JSON lines, redaction, 4xx errors at warn (Lane P, spec 12.1).
  logger: log,
  graphQL: { disable: true },
  admin: {
    user: 'users',
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
    components: {
      graphics: {
        Logo: '/admin/components/Logo#Logo',
        Icon: '/admin/components/Icon#Icon',
      },
      // After the groups (C12): the calendar for staff, then the status view for admins.
      afterNavLinks: [
        '/admin/components/CalendarNavLink#CalendarNavLink',
        '/admin/components/SystemStatusNavLink#SystemStatusNavLink',
      ],
      // The dashboard in task order (H33; G15: not the experimental widgets API): today's
      // requests, the content calendar, SEO health, then the content gaps for admins.
      beforeDashboard: [
        '/admin/components/BookingsToday#BookingsToday',
        '/admin/components/ContentCalendar#ContentCalendar',
        '/admin/components/SeoHealth#SeoHealth',
        '/admin/components/ContentGapsSummary#ContentGapsSummary',
      ],
      views: {
        systemStatus: {
          Component: '/admin/views/SystemStatus#SystemStatusView',
          path: '/system-status',
          exact: true,
          meta: { title: 'وضعیت سیستم' },
        },
        contentCalendar: {
          Component: '/admin/views/EditorialCalendar#EditorialCalendar',
          path: '/content-calendar',
          exact: true,
          meta: { title: adminText('admin.calendar.title') },
        },
      },
    },
    // H10: the three QA widths; collections set their own preview URL (fields/factories.ts).
    livePreview: {
      breakpoints: [
        { name: 'mobile', label: adminText('admin.preview.mobile'), width: 390, height: 844 },
        { name: 'tablet', label: adminText('admin.preview.tablet'), width: 820, height: 1180 },
        { name: 'desktop', label: adminText('admin.preview.desktop'), width: 1440, height: 900 },
      ],
    },
    timezones: {
      supportedTimezones: [{ label: 'تهران', value: 'Asia/Tehran' }],
      defaultTimezone: 'Asia/Tehran',
    },
  },
  // H34: Payload's Persian strings that still carry English words get Persian ones.
  i18n: {
    supportedLanguages: { fa },
    fallbackLanguage: 'fa',
    translations: { fa: PAYLOAD_FA_OVERRIDES },
  },
  collections,
  globals,
  editor: richTextEditor,
  // Payload's own /api/payload-jobs/run: the cron bearer or a TOTP-verified admin (the site's
  // scheduler is /api/cron/tick). The schedulePublish task comes from the collections' drafts;
  // `notify` delivers the Notifier's messages (src/lib/notify, freeze G11).
  jobs: { access: { run: canRunJobs }, tasks: [notifyTask] },
  db: databaseAdapter(srcDir),
  hooks: { afterError: [keepValidationDetails] },
  onInit: (payload) => {
    logPoolErrors(payload.db, (line) => log.warn(line));
    // H12: a refused scheduled publish records the block messages for the calendar.
    withScheduleBlockMessages(payload.config);
    // Error alerts reach the Notifier once Payload is up (src/lib/log/requestError.ts, R-13).
    setErrorAlertSink((alert) => notifier.notify(alert));
  },
  // One image encode at a time: 23 sizes in parallel peaked at 1.1 GB per upload (UP-6).
  sharp: limitedSharp(1),
  // Types come only from `npm run generate:types` (freeze 2.3; CI checks drift). Payload's
  // default regenerates the file in a child process on every non-production boot, int tests too.
  typescript: { outputFile: path.resolve(srcDir, 'payload-types.ts'), autoGenerate: false },
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
    // H34: the plugin's views have no title, so the tab read «Payload» (views only, no access).
    (config) => {
      const views = config.admin?.components?.views ?? {};
      for (const [key, title] of [
        ['SetupTOTP', adminText('admin.totp.setup')],
        ['SetupTOTPBackslash', adminText('admin.totp.setup')],
        ['VerifyTOTP', adminText('admin.totp.verify')],
        ['VerifyTOTPBackslash', adminText('admin.totp.verify')],
      ] as const) {
        if (views[key]) views[key] = { ...views[key], meta: { title } };
      }
      return config;
    },
  ],
});
