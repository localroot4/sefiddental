import { MinimalTemplate } from '@payloadcms/next/templates';
import { formatAdminURL } from '@payloadcms/ui/shared';
import { redirect } from 'next/navigation';
import { Secret, TOTP } from 'otpauth';
import type { AdminViewServerProps, PayloadRequest } from 'payload';
import type { payloadTotp } from 'payload-totp';
import { toDataURL } from 'qrcode';

import { adminText } from '@/i18n/fa-admin';
import { toPersianDigits } from '@/lib/digits';

import { CodeForm, CopyButton } from './CodeForm';
import { pendingTotpSecret, safeBackPath } from './server';
import styles from './totp.module.css';

/*
 * payload-totp's setup and verify views, replaced (src/payload.config.ts) for a setup secret that
 * survives a reload and a code input that takes Persian digits. Same routes, copy and endpoints.
 */

type Props = AdminViewServerProps & { pluginOptions: Parameters<typeof payloadTotp>[0] };

/** The plugin's own strings (its i18n), so the headings stay those the admin guide quotes. */
function pluginText(req: PayloadRequest, key: string, digits?: number): string {
  const text = (req.i18n.t as (key: string) => string)(`totpPlugin:${key}`);
  return text.replace('{digits}', toPersianDigits(String(digits ?? '')));
}

/** The signed-in user with what the plugin's provider decides on; redirects when there is none. */
function sessionUser(req: PayloadRequest) {
  const { routes, serverURL } = req.payload.config;
  if (!req.user) redirect(formatAdminURL({ adminRoute: routes.admin, path: '/login', serverURL }));
  return req.user as typeof req.user & { hasTotp?: boolean | null; _strategy?: string };
}

function Form({ props, req, action }: { props: Props; req: PayloadRequest; action: string }) {
  const length = props.pluginOptions.totp?.digits ?? 6;
  const { admin, api } = req.payload.config.routes;
  return (
    <>
      <p>{pluginText(req, 'setup:enterCode', length)}</p>
      <CodeForm
        action={`${req.payload.config.serverURL}${api}${action}`}
        back={safeBackPath(admin, props.searchParams?.back)}
        clearLabel={adminText('admin.totp.clear')}
        failedMessage={adminText('admin.totp.failed')}
        labels={Array.from({ length }, (_, i) =>
          adminText('admin.totp.digit', {
            n: toPersianDigits(String(i + 1)),
            total: toPersianDigits(String(length)),
          }),
        )}
      />
    </>
  );
}

export async function TotpSetupView(props: Props) {
  const { req } = props.initPageResult;
  const { routes, serverURL } = req.payload.config;
  const user = sessionUser(req);
  if (user.hasTotp) redirect(formatAdminURL({ adminRoute: routes.admin, path: '/', serverURL }));
  const secret = pendingTotpSecret(req.payload.secret, user);
  if (!secret) {
    throw new Error(
      'TOTP setup: the user has no session ID or updatedAt, so no setup secret can be derived. Check auth.useSessions and timestamps on the users collection.',
    );
  }
  const { totp: options } = props.pluginOptions;
  const totp = new TOTP({
    algorithm: options?.algorithm ?? 'SHA1',
    digits: options?.digits ?? 6,
    issuer: options?.issuer ?? 'Payload',
    label: user.email,
    period: options?.period ?? 30,
    secret: Secret.fromBase32(secret),
  });
  const qr = await toDataURL(totp.toString(), { margin: 2, width: 228 });
  return (
    <MinimalTemplate className={styles.root}>
      <h1>{pluginText(req, 'setup:title')}</h1>
      <p>{pluginText(req, 'setup:description')}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimize */}
      <img
        alt={adminText('admin.totp.qr')}
        className={styles.qr}
        height={228}
        src={qr}
        width={228}
      />
      <details className={styles.manual}>
        <summary>{pluginText(req, 'setup:addCodeManually')}</summary>
        <div className={styles.secret}>
          <code dir="ltr">{secret.match(/.{1,4}/g)?.join(' ')}</code>
          <CopyButton
            done={adminText('admin.totp.copied')}
            label={adminText('admin.totp.copy')}
            value={secret}
          />
        </div>
      </details>
      <Form action="/setup-totp" props={props} req={req} />
    </MinimalTemplate>
  );
}

export function TotpVerifyView(props: Props) {
  const { req } = props.initPageResult;
  const { routes, serverURL } = req.payload.config;
  const user = sessionUser(req);
  if (!user.hasTotp || user._strategy === 'totp') {
    redirect(formatAdminURL({ adminRoute: routes.admin, path: '/', serverURL }));
  }
  return (
    <MinimalTemplate className={styles.root}>
      <h1>{pluginText(req, 'verify:title')}</h1>
      <Form action="/verify-totp" props={props} req={req} />
    </MinimalTemplate>
  );
}
