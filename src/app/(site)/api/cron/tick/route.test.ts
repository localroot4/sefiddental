import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

const mocks = vi.hoisted(() => {
  const payload = {
    jobs: {
      handleSchedules: vi.fn(),
      run: vi.fn(),
    },
    updateGlobal: vi.fn(async () => ({})),
  };
  return { payload };
});
vi.mock('@/lib/data/payload', () => ({ getPayloadClient: async () => mocks.payload }));

const SECRET = 's'.repeat(48); // testEnv's CRON_SECRET
const tick = (authorization?: string) =>
  new Request('https://sefiddental.ir/api/cron/tick', {
    headers: authorization ? { authorization } : {},
  });

describe('GET /api/cron/tick (spec 11.3, freeze decision 6)', () => {
  beforeEach(() => {
    stubSiteEnv();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { jobs, updateGlobal } = mocks.payload;
    jobs.handleSchedules.mockReset().mockResolvedValue({ queued: [{}], errored: [], skipped: [] });
    jobs.run.mockReset().mockResolvedValue({
      jobStatus: { a: { status: 'success' }, b: { status: 'error' } },
      remainingJobsFromQueried: 1,
    });
    updateGlobal.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('CT1 no bearer, a wrong bearer or a basic header: 401, nothing runs', async () => {
    const { GET } = await import('./route');
    for (const auth of [undefined, 'Bearer wrong', `Basic ${SECRET}`, `Bearer ${SECRET}x`]) {
      const res = await GET(tick(auth));
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
    }
    expect(mocks.payload.jobs.run).not.toHaveBeenCalled();
  });

  it('CT2 schedules, then runs every queue with limit 20, records the run, answers the summary', async () => {
    const { GET } = await import('./route');
    const res = await GET(tick(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      ranJobs: 2,
      failed: 1,
      remaining: 1,
      scheduled: 1,
      durationMs: expect.any(Number),
    });
    const { jobs, updateGlobal } = mocks.payload;
    expect(jobs.handleSchedules).toHaveBeenCalledWith({ allQueues: true });
    expect(jobs.run).toHaveBeenCalledWith({ allQueues: true, limit: 20 });
    expect(jobs.handleSchedules.mock.invocationCallOrder[0]).toBeLessThan(
      jobs.run.mock.invocationCallOrder[0]!,
    );
    expect(updateGlobal).toHaveBeenCalledWith({
      slug: 'system-state',
      data: {
        lastCronRunAt: expect.any(String),
        lastCronRanJobs: 2,
        lastCronFailed: 1,
        lastCronDurationMs: expect.any(Number),
        lastCronError: null,
      },
      context: { skipRevalidate: true, skipAudit: true },
    });
  });

  it('CT3 overlapping ticks in one process share one run', async () => {
    const { GET } = await import('./route');
    const [a, b] = await Promise.all([
      GET(tick(`Bearer ${SECRET}`)),
      GET(tick(`Bearer ${SECRET}`)),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(mocks.payload.jobs.run).toHaveBeenCalledTimes(1);
    expect(mocks.payload.updateGlobal).toHaveBeenCalledTimes(1);
    // The next minute runs again.
    await GET(tick(`Bearer ${SECRET}`));
    expect(mocks.payload.jobs.run).toHaveBeenCalledTimes(2);
  });

  it('CT4 a failing run is recorded (200 characters at most) and answers 500', async () => {
    mocks.payload.jobs.run.mockRejectedValue(new Error('x'.repeat(300)));
    const { GET } = await import('./route');
    const res = await GET(tick(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const [[call]] = mocks.payload.updateGlobal.mock.calls as unknown as [
      [{ data: { lastCronError: string; lastCronRanJobs: number } }],
    ];
    expect(call.data.lastCronError).toHaveLength(200);
    expect(call.data.lastCronRanJobs).toBe(0);
  });
});
