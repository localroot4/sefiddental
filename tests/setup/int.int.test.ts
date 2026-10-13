// Self-test of the `int` setup (tests/setup/int.ts): the adapter the suite runs on is the one
// the environment asks for, and Payload can read and count through it. Runs in both CI passes.
import config from '@payload-config';
import { getPayload } from 'payload';
import { describe, expect, it } from 'vitest';

describe('int setup', () => {
  it('T-INT1 uses SQLite with push by default, the migrated Postgres with INT_DATABASE_URL', () => {
    if (process.env.INT_DATABASE_URL) {
      expect(process.env.DATABASE_URL).toBe(process.env.INT_DATABASE_URL);
      expect(process.env.DB_PUSH).toBe('false');
    } else {
      expect(process.env.DATABASE_URL).toMatch(/^file:.*sefid-int-[^/]+\/int-\d+\.db$/);
      expect(process.env.DB_PUSH).toBe('true');
    }
  });

  it('T-INT2 Payload starts on that database and reads the users table', async () => {
    const payload = await getPayload({ config });
    const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true });
    expect(totalDocs).toBeGreaterThanOrEqual(0);
  });
});
