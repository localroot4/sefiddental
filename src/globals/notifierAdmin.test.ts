import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import type { ServerEnv } from '@/lib/env';

import { needsEnv } from './notifierAdmin';
import { Notifier } from './Settings';

const req = (user: object | null) => ({ req: { user } as unknown as PayloadRequest });
const admin = { id: 1, role: 'admin' };

describe('notifier switches need the server credentials (admin-notify.md 9.7)', () => {
  it('NT11 a person cannot turn on a channel the server cannot send on', () => {
    const noSmtp = () => ({ smtp: null }) as unknown as ServerEnv;
    const withSmtp = () => ({ smtp: { host: 'mail' } }) as unknown as ServerEnv;
    const rule = (read: () => ServerEnv) => needsEnv((env) => env.smtp !== null, 'نیاز', read);
    expect(rule(noSmtp)(true, req(admin))).toBe('نیاز');
    expect(rule(withSmtp)(true, req(admin))).toBe(true);
    expect(rule(noSmtp)(false, req(admin))).toBe(true);
    // Seeders and tests write without a user.
    expect(rule(noSmtp)(true, req(null))).toBe(true);
  });

  it('NT11b each switch carries its rule, and the global has the test endpoint and button', () => {
    const groups = Notifier.fields as Array<{
      name: string;
      fields: Array<{ name: string; validate?: unknown }>;
    }>;
    for (const name of ['mail', 'telegram', 'sms']) {
      const enabled = groups.find((g) => g.name === name)?.fields.find((f) => f.name === 'enabled');
      expect(enabled?.validate, name).toEqual(expect.any(Function));
    }
    expect(Notifier.endpoints).toEqual([
      expect.objectContaining({ path: '/test', method: 'post' }),
    ]);
    expect(Notifier.admin?.components?.elements?.beforeDocumentControls).toEqual([
      '/admin/components/NotifierTestButton#NotifierTestButton',
    ]);
  });
});
