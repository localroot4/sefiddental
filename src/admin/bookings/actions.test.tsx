import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  BeforeListTableServerProps,
  DefaultCellComponentProps,
  DefaultServerCellComponentProps,
  Payload,
} from 'payload';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotifierTestButton } from '@/admin/components/NotifierTestButton';

import { BookingTabs } from './BookingTabs';
import { BulkSpam } from './BulkSpam';
import { CallbackDueCell, KindCell, ReceivedAtCell } from './cells';
import { ExportCsv } from './ExportCsv';
import { RowActions } from './RowActions';

const h = vi.hoisted(() => ({
  selection: {
    count: 25,
    selectAll: 'allAvailable',
    getQueryParams: (extra?: object) => `?where=${encodeURIComponent(JSON.stringify(extra ?? {}))}`,
    toggleAll: () => {},
  },
  openModal: (_slug: string) => {},
  refresh: () => {},
  toast: {
    success: (_m: string) => {},
    warning: (_m: string) => {},
    error: (_m: string) => {},
    info: (_m: string) => {},
  },
}));

vi.mock('@payloadcms/ui', () => ({
  Button: ({
    children,
    disabled,
    id,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    id?: string;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} id={id} onClick={onClick} type="button">
      {children}
    </button>
  ),
  Pill: ({ children }: { children: ReactNode }) => <span data-pill="">{children}</span>,
  // Rendered open: the test presses its confirm button as a person would.
  ConfirmationModal: ({ body, onConfirm }: { body: ReactNode; onConfirm: () => unknown }) => (
    <div role="dialog">
      {body}
      <button id="confirm-action" onClick={() => void onConfirm()} type="button">
        confirm
      </button>
    </div>
  ),
  toast: h.toast,
  useFormModified: () => false,
  useConfig: () => ({
    getEntityConfig: () => ({
      slug: 'bookings',
      admin: { listSearchableFields: ['phoneNational', 'name'], useAsTitle: 'listTitle' },
    }),
  }),
  useModal: () => ({ openModal: h.openModal }),
  useSelection: () => h.selection,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: h.refresh }),
  useSearchParams: () => new URLSearchParams('search=0912'),
}));

beforeEach(() => {
  for (const fn of ['getQueryParams', 'toggleAll'] as const) vi.spyOn(h.selection, fn);
  for (const fn of ['success', 'warning', 'error', 'info'] as const) vi.spyOn(h.toast, fn);
  vi.spyOn(h, 'openModal');
  vi.spyOn(h, 'refresh');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('bulk «علامت هرزنامه» (admin-notify.md 4.7)', () => {
  it('BS2 asks first, then changes only what the list shows: "select all" keeps the search', async () => {
    const fetch = vi.fn(async () => Response.json({ docs: [{}, {}], errors: [] }));
    vi.stubGlobal('fetch', fetch);
    render(<BulkSpam />);
    fireEvent.click(screen.getByText('علامت هرزنامه', { selector: '#bookings-bulk-spam' }));
    expect(h.openModal).toHaveBeenCalledWith('bookings-bulk-spam-confirm');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('۲۵ درخواست هرزنامه می‌شود.');

    fireEvent.click(screen.getByText('confirm'));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('۲ درخواست هرزنامه شد.'));
    // Payload's getQueryParams sends only the URL filter in this mode; the search goes with it.
    expect(h.selection.getQueryParams).toHaveBeenCalledWith({
      or: [{ phoneNational: { like: '0912' } }, { name: { like: '0912' } }],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/bookings\?where=/),
      expect.objectContaining({ method: 'PATCH', body: '{"status":"spam"}' }),
    );
    expect(h.selection.toggleAll).toHaveBeenCalledOnce();
    expect(h.refresh).toHaveBeenCalledOnce();
  });

  it('BS4 a refused call shows the server’s message and keeps the selection', async () => {
    const answer = { errors: [{ message: 'اجازهٔ این کار را ندارید.' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(answer, { status: 403 })),
    );
    render(<BulkSpam />);
    fireEvent.click(screen.getByText('confirm'));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('اجازهٔ این کار را ندارید.'));
    expect(h.selection.toggleAll).not.toHaveBeenCalled();
  });
});

describe('booking tabs slot (admin-notify.md 4.1, 7)', () => {
  const count = vi.fn(async () => ({ totalDocs: 1 }));
  const payload = {
    config: { custom: { totp: { pluginOptions: { forceSetup: true, collection: 'users' } } } },
    count,
  } as unknown as Payload;
  const tabs = (user: object | null) =>
    BookingTabs({ payload, user, searchParams: {} } as unknown as BeforeListTableServerProps);

  it('TB4 TOTP-verified staff only; the CSV button for admins only', async () => {
    const admin = { id: 1, role: 'admin', collection: 'users' };
    expect(await tabs({ ...admin, _strategy: 'local-jwt', hasTotp: true })).toBeNull();
    expect(await tabs(null)).toBeNull();
    expect(count).not.toHaveBeenCalled();
    const asAdmin = renderToStaticMarkup((await tabs({ ...admin, _strategy: 'totp' }))!);
    expect(asAdmin).toContain('id="booking-tabs"');
    expect(asAdmin).toContain('id="bookings-export-csv"');
    const asEditor = renderToStaticMarkup(
      (await tabs({ ...admin, role: 'editor', _strategy: 'totp' }))!,
    );
    expect(asEditor).toContain('id="booking-tabs"');
    expect(asEditor).not.toContain('bookings-export-csv');
  });
});

describe('row restore and list cells (admin-notify.md 4.1, 4.5)', () => {
  it('RA1 a restore sends one PATCH, stays pending and moves focus to the current tab', async () => {
    const fetch = vi.fn(async () => Response.json({ doc: {} }));
    vi.stubGlobal('fetch', fetch);
    render(
      <>
        <nav id="booking-tabs">
          <a href="#all">همه</a>
          <a aria-current="page" href="#suspicious">
            مشکوک
          </a>
        </nav>
        <RowActions
          {...({ rowData: { id: 5, status: 'spam' } } as unknown as DefaultCellComponentProps)}
        />
      </>,
    );
    const button = screen.getByRole('button', { name: 'بازگرداندن' });
    fireEvent.click(button);
    await waitFor(() =>
      expect(h.toast.success).toHaveBeenCalledWith('درخواست بازگردانده شد و در «جدید» است.'),
    );
    expect(h.refresh).toHaveBeenCalledOnce();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledOnce();
    expect(document.activeElement?.textContent).toBe('مشکوک');
  });

  it('CL2 the red «فوری» pill and the «گذشته» pill only while a request waits past its time', () => {
    const cell = (props: object) => props as unknown as DefaultServerCellComponentProps;
    expect(renderToStaticMarkup(<KindCell {...cell({ cellData: 'emergency' })} />)).toContain(
      '<span data-pill="">فوری</span>',
    );
    expect(renderToStaticMarkup(<KindCell {...cell({ cellData: 'regular' })} />)).toBe(
      '<span>عادی</span>',
    );
    const past = '2020-01-01T08:00:00.000Z';
    const due = (status: string) =>
      renderToStaticMarkup(<CallbackDueCell {...cell({ cellData: past, rowData: { status } })} />);
    expect(due('new')).toContain('گذشته');
    expect(due('contacted')).not.toContain('گذشته');
    expect(
      renderToStaticMarkup(
        <ReceivedAtCell {...cell({ rowData: { createdAt: '2026-10-15T06:42:00.000Z' } })} />,
      ),
    ).toContain('۲۳ مهر، ۱۰:۱۲');
  });
});

describe('notifier test button (admin-notify.md 9.8)', () => {
  it('NT16 the toast follows the answer: an error when a switched-on channel did not send', async () => {
    const answer = { message: 'ایمیل: روشن است ولی…', level: 'error' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(answer)),
    );
    render(<NotifierTestButton />);
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پیام آزمایشی' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(answer.message));
    expect(h.toast.info).not.toHaveBeenCalled();
  });
});

describe('CSV button (admin-notify.md 4.8)', () => {
  it('XC1 the file link is in the document when clicked; its URL lives on after the click', async () => {
    const headers = {
      'Content-Disposition': 'attachment; filename="bookings-1405-07-23-1012.csv"',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('a,b', { headers })),
    );
    const created = vi.fn(() => 'blob:csv');
    const revoked = vi.fn();
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clicked: Array<[string, boolean]> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push([this.download, this.isConnected]);
    });
    try {
      render(<ExportCsv />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(clicked).toEqual([['bookings-1405-07-23-1012.csv', true]]));
      expect(revoked).not.toHaveBeenCalled();
      expect(document.querySelector('a[download]')).toBeNull();
    } finally {
      Object.assign(URL, original);
    }
  });
});
