import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlanRow } from '@/lib/redirects/importCsv';

import { ImportCsv } from './ImportCsv';

const h = vi.hoisted(() => ({
  refresh: () => {},
  toast: { success: (_m: string) => {}, error: (_m: string) => {} },
}));

vi.mock('@payloadcms/ui', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  toast: h.toast,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));

beforeEach(() => {
  vi.spyOn(h.toast, 'success');
  vi.spyOn(h, 'refresh');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CSV = '/old-a,/خدمات\n/old-b,https://old.ir/پزشکان\n/old-c?id=1,/خدمات';
const ROWS: PlanRow[] = [
  { line: 1, from: '/old-a', to: '/خدمات', status: '301', outcome: 'new' },
  {
    line: 2,
    from: '/old-b',
    to: '/پزشکان/نیست',
    status: '301',
    outcome: 'update',
    id: 7,
    note: 'هشدار: مقصد صفحهٔ منتشرشده‌ای نیست و بازدیدکننده به صفحهٔ «پیدا نشد» می‌رسد.',
  },
  { line: 3, from: '/old-c?id=1', to: '/خدمات', status: '301', outcome: 'refused', manual: true },
  { line: 4, from: '/old-d', to: null, status: '410', outcome: 'unchanged', id: 8 },
];

function choose(csv = CSV) {
  render(<ImportCsv />);
  fireEvent.click(screen.getByText('ورود نشانی‌های سایت قبلی از فایل'));
  fireEvent.change(screen.getByLabelText('دامنه‌های سایت قبلی'), { target: { value: 'old.ir' } });
  const file = new File([csv], 'old.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('فایل'), { target: { files: [file] } });
}

const bodyOf = (fetch: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse((fetch.mock.calls[call]![1] as RequestInit).body as string) as Record<string, unknown>;

describe('«ورود نشانی‌های سایت قبلی» on the Redirects list (H19)', () => {
  it('IM1 asks for a file first and sends nothing', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<ImportCsv />);
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    expect(screen.getByRole('alert').textContent).toBe('اول فایل را انتخاب کنید.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('IM2 the dry run shows one row per line with its outcome, and the count to write', async () => {
    const fetch = vi.fn(async () => Response.json({ rows: ROWS, digest: 'd1' }));
    vi.stubGlobal('fetch', fetch);
    choose();
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    await screen.findByRole('table');
    expect(fetch).toHaveBeenCalledWith(
      '/api/redirects/import',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    );
    expect(bodyOf(fetch, 0)).toEqual({ csv: CSV, origins: 'old.ir' });
    expect(screen.getByRole('status').textContent).toBe(
      '۱ ردیف تازه، ۱ به‌روزرسانی، ۱ بدون تغییر، ۱ ردشده، ۱ هشدار',
    );
    const cells = screen.getAllByRole('row').map((row) => row.textContent);
    expect(cells[1]).toBe('۱/old-a/خدماتتازه');
    expect(cells[2]).toContain('به‌روزرسانی');
    expect(cells[2]).toContain('هشدار: مقصد');
    expect(cells[3]).toContain('رد شد');
    expect(cells[4]).toBe('۴/old-dحذف‌شده (۴۱۰)بدون تغییر');
    expect(screen.getByRole('region', { name: 'نتیجهٔ بررسی فایل' }).tabIndex).toBe(0);
    expect(screen.getByText('ثبت ۲ ردیف')).toBeTruthy();
  });

  it('IM3 apply sends the checked file and digest, then refreshes the list', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ rows: ROWS, digest: 'd1' }))
      .mockResolvedValueOnce(Response.json({ rows: ROWS, digest: 'd1', written: 2 }));
    vi.stubGlobal('fetch', fetch);
    choose();
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    fireEvent.click(await screen.findByText('ثبت ۲ ردیف'));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('۲ ردیف ثبت شد.'));
    expect(bodyOf(fetch, 1)).toEqual({ csv: CSV, origins: 'old.ir', apply: true, digest: 'd1' });
    expect(h.refresh).toHaveBeenCalled();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('IM4 a changed file or domain list drops the checked plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ rows: ROWS, digest: 'd1' })),
    );
    choose();
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('دامنه‌های سایت قبلی'), { target: { value: 'x.ir' } });
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('IM5 the server message is shown as it is; a file error leaves nothing to apply', async () => {
    const message = 'از زمان بررسی، تغییر مسیرها یا صفحه‌های سایت عوض شده‌اند.';
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ rows: [], error: 'فایل ردیفی ندارد.', digest: 'd' }))
      .mockResolvedValueOnce(Response.json({ message }, { status: 409 }))
      .mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetch);
    choose();
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    expect((await screen.findByRole('alert')).textContent).toBe('فایل ردیفی ندارد.');
    expect(screen.queryByText(/^ثبت /)).toBeNull();
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message));
    fireEvent.click(screen.getByText('بررسی بدون ذخیره'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'انجام نشد. اتصال را بررسی کنید و دوباره بزنید.',
      ),
    );
  });
});
