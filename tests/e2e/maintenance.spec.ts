// Maintenance mode (freeze 3.13 step 4, PLAT 14.3) against the second standalone server, which
// playwright.config.ts starts on E2E_PORT + 1 with MAINTENANCE_MODE=on.
import { expect, test } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? '3000') + 1;
test.use({ baseURL: `http://localhost:${port}` });

test.describe('maintenance mode', () => {
  test('T-MT1 a public page answers 503 with Retry-After and the static Persian page', async ({
    page,
  }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(503);
    expect(response?.headers()['retry-after']).toBe('900');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('T-MT2 API calls get JSON 503; health and the admin stay reachable', async ({ request }) => {
    test.fixme(true, 'PENDING wave 2: /api/health (Lane P) does not exist yet.');
    const api = await request.get('/api/form-session');
    expect(api.status()).toBe(503);
    expect(await api.json()).toEqual({ status: 'maintenance' });
    expect((await request.get('/api/health')).status()).toBe(200);
    expect((await request.get('/admin/login')).status()).toBe(200);
  });
});
