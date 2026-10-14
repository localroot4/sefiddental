import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  assertEnv: () => {
    throw new Error('Environment is incomplete:\nCRON_SECRET missing: set it');
  },
}));

describe('register (SEC-S1)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('IN1 an incomplete environment prints one fatal line and exits the process', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { register } = await import('./instrumentation');
    await register();
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(error.mock.calls[0]?.[0])) as Record<string, string>;
    expect(line).toMatchObject({ level: 'fatal', msg: 'env_invalid' });
    expect(line.detail).toContain('CRON_SECRET missing');
  });
});
