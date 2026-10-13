// Frame-time baseline of the home placeholder at tier 0 under 4x and 6x CPU throttling, on the
// SwiftShader profile (00-master.md section 5). Phase 3 has no scenes: this records numbers for
// the report and proves the throttling and sampling helpers work. Phases 7 and 8 add fps gates.
import { expect, test } from '@playwright/test';

import { collectGarbage, throttleCpu } from '../helpers/cpu';
import { sampleFrames } from '../helpers/frames';

for (const rate of [4, 6] as const) {
  test(`T-PF${rate} home at tier 0 keeps rendering frames under ${rate}x CPU throttling`, async ({
    page,
  }, testInfo) => {
    await page.goto('/?tier=0', { waitUntil: 'load' });
    await collectGarbage(page);
    const restore = await throttleCpu(page, rate);
    const stats = await sampleFrames(page, { warmupMs: 1000, durationMs: 4000, drive: 'wheel' });
    await restore();
    testInfo.annotations.push({ type: `frames ${rate}x`, description: JSON.stringify(stats) });
    await testInfo.attach(`frames-${rate}x.json`, {
      body: JSON.stringify(stats, null, 2),
      contentType: 'application/json',
    });
    expect(stats.frames).toBeGreaterThan(0);
    expect(stats.medianFps).toBeGreaterThan(0);
  });
}
