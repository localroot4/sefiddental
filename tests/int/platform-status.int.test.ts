// The admin System status view (spec-platform 13; freeze 29): admins who passed TOTP see the
// collected status, everyone else gets notFound(). Payload's template and UI are replaced by
// pass-through components: this test covers the gate and the data, the browser covers the look.
import { createLocalReq, type Payload } from 'payload';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { SystemStatusData } from '@/admin/views/systemStatusData';
import { ADMIN_ROUTE } from '@/lib/paths';

import { getTestPayload, type StaffUser, staffUsers } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: (props: { children: unknown }) => props.children,
}));
vi.mock('@payloadcms/ui', () => ({ Gutter: (props: { children: unknown }) => props.children }));

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;

async function view(user: object | null) {
  const { SystemStatusView } = await import('@/admin/views/SystemStatus');
  const req = await createLocalReq({ user: user as never }, payload);
  return SystemStatusView({
    initPageResult: { req, permissions: {}, visibleEntities: { collections: [], globals: [] } },
    user,
  } as never);
}

const isNotFound = (err: unknown) =>
  String((err as { digest?: string }).digest ?? '').startsWith('NEXT_HTTP_ERROR_FALLBACK;404');

describe('System status view access and contents', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
  });

  it('SV1 editor, anonymous and an admin without the TOTP step get notFound()', async () => {
    for (const user of [editor, null, { ...admin, _strategy: 'local-jwt', hasTotp: true }]) {
      const err = await view(user).then(
        () => null,
        (e: unknown) => e,
      );
      expect(isNotFound(err)).toBe(true);
    }
  });

  it('SV2 a verified admin gets the collected status: database, queue, cron, media, gaps', async () => {
    const element = (await view(admin)) as ReactElement<{
      children: ReactElement<{ children: ReactElement<{ data: SystemStatusData }> }>;
    }>;
    const data = element.props.children.props.children.props.data;
    expect(data.database).toMatchObject({ reachable: true, latencyMs: expect.any(Number) });
    expect(data.jobs.queued).toEqual(expect.any(Number));
    expect(data.jobs.failed).toEqual(expect.any(Array));
    // The media folder does not exist before the first upload: the disk of its parent answers.
    expect(data.media).toMatchObject({
      storage: 'local',
      files: expect.any(Number),
      freeBytes: expect.any(Number),
    });
    expect(data.runtime.node).toBe(process.version);
    expect(data.gaps).not.toBeNull();
    for (const group of data.gaps!.groups) {
      for (const item of group.items)
        expect(item.adminUrl).toMatch(new RegExp(`^${ADMIN_ROUTE}/(globals|collections)/`));
    }
    // No secret reaches the view: settings are flags, never values.
    const serialized = JSON.stringify(data);
    for (const secret of [
      process.env.CRON_SECRET,
      process.env.PAYLOAD_SECRET,
      process.env.INTERNAL_API_TOKEN,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
