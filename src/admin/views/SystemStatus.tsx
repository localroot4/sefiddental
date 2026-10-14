import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { notFound } from 'next/navigation';
import type { AdminViewServerProps, PayloadRequest } from 'payload';
import { totpAccess } from 'payload-totp';

import { hasRole } from '@/access/roles';
import { readEnv } from '@/lib/env';

import { SystemStatusBody } from './SystemStatusBody';
import { collectSystemStatus } from './systemStatusData';

// Custom views are public by default (Payload docs, custom views): only an admin whose session
// passed the TOTP code may see the status; everyone else gets the same 404 as an unknown page.
const verifiedAdmin = totpAccess(({ req }: { req: PayloadRequest }) => hasRole(req.user, 'admin'));

/** `/admin/system-status` (freeze 29): admin only, inside Payload's default template and nav. */
export async function SystemStatusView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams, user } = props;
  const { req } = initPageResult;
  if ((await verifiedAdmin({ req })) !== true) notFound();
  const data = await collectSystemStatus(req.payload, readEnv());
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <SystemStatusBody data={data} />
      </Gutter>
    </DefaultTemplate>
  );
}
