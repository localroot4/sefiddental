// IC: the old-URL CSV import (phase 6 H19, plan section 6, C27) as a pure plan: what each row of
// the file would do, decided before anything is written.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ADMIN_ROUTE } from '@/lib/paths';

import {
  type ExistingRedirect,
  parseCsv,
  parseOrigins,
  planImport,
  type PlanContext,
} from './importCsv';

const LIVE = new Set(['/', '/خدمات', '/پزشکان', '/مقالات', '/خدمات/ترمیم-دندان']);

const SYSTEM_PATH_NOTE = `نشانی‌های سیستمی (${ADMIN_ROUTE.slice(1)}، api، _next) را نمی‌توان منتقل کرد.`;

function context(over: Partial<PlanContext> = {}): PlanContext {
  return {
    origins: ['old-sefid.ir'],
    existing: new Map(),
    activeCount: 0,
    isLive: (path) => LIVE.has(path),
    cap: 5000,
    ...over,
  };
}

const existing = (rows: Record<string, Omit<ExistingRedirect, 'id'>>) =>
  new Map(Object.entries(rows).map(([from, row], i) => [from, { id: i + 1, ...row }]));

const VIP = {
  to: '/خدمات/ترمیم-دندان#سطح-ترمیم',
  statusCode: '301',
  source: 'alias',
  active: true,
};

describe('parseCsv (RFC 4180, as spreadsheets save it)', () => {
  it('IC1 BOM, CRLF and LF, quoted commas, doubled quotes, blank lines', () => {
    const text = '\uFEFFa,b\r\n"c,d","e ""f"""\n\n  g , h  \r\n';
    expect(parseCsv(text)).toEqual({
      records: [
        { line: 1, cells: ['a', 'b'] },
        { line: 2, cells: ['c,d', 'e "f"'] },
        { line: 4, cells: ['g', 'h'] },
      ],
    });
  });

  it('IC2 a quoted line break stays in its cell; the next record keeps its own line number', () => {
    expect(parseCsv('"/a\nb",/x\n/c,/y')).toEqual({
      records: [
        { line: 1, cells: ['/a\nb', '/x'] },
        { line: 3, cells: ['/c', '/y'] },
      ],
    });
  });

  it('IC12 the separator comes from the first record: comma, «;», «؛» or tab; a tie keeps the comma', () => {
    const cells = (text: string) => {
      const parsed = parseCsv(text);
      return 'records' in parsed ? parsed.records.map((r) => r.cells) : parsed;
    };
    expect(cells('/a;/b;301\n"/c;d";/e')).toEqual([
      ['/a', '/b', '301'],
      ['/c;d', '/e'],
    ]);
    expect(cells('نشانی قدیمی؛مقصد؛کد\n/a؛/b،x')).toEqual([
      ['نشانی قدیمی', 'مقصد', 'کد'],
      ['/a', '/b،x'],
    ]);
    expect(cells('/a\t/b\n/c\t/d')).toEqual([
      ['/a', '/b'],
      ['/c', '/d'],
    ]);
    // "/a;b" as a path: one comma and one semicolon, so the comma stays.
    expect(cells('/a;b,/c')).toEqual([['/a;b', '/c']]);
  });

  it('IC3b a file not saved as Unicode (decoded with replacement characters) is refused', () => {
    expect(parseCsv('/\uFFFD\uFFFD,/x')).toEqual({
      error:
        'حروف فایل خوانده نشد، چون فایل با کدگذاری یونی‌کد ذخیره نشده است. در اکسل با «ذخیره به‌عنوان» نوع CSV با کدگذاری یونی‌کد را انتخاب کنید.',
    });
  });

  it('IC3 an unclosed quote names the line where its record starts', () => {
    expect(parseCsv('/a,/b\n"/c,/d\n/e,/f')).toEqual({
      error:
        'در سطر ۲ یک علامت نقل‌قول (") بسته نشده است. فایل را در صفحه‌گسترده دوباره ذخیره کنید.',
    });
  });
});

describe('parseOrigins', () => {
  it('IC4 host names from URLs or bare names, lower case, without www, Persian commas too', () => {
    expect(parseOrigins(' https://www.Old-Sefid.ir/x، old2.ir , http://old3.ir:8080 ')).toEqual([
      'old-sefid.ir',
      'old2.ir',
      'old3.ir',
    ]);
    expect(parseOrigins('')).toEqual([]);
  });
});

describe('planImport (dry run and apply decide the same rows)', () => {
  it('IC5 the fixture: one outcome per row, with the reason', () => {
    const text = readFileSync('tests/fixtures/old-urls.csv', 'utf8');
    const plan = planImport(text, context({ existing: existing({ '/vip': VIP }), activeCount: 1 }));
    expect(plan.error).toBeUndefined();
    const brief = plan.rows.map((r) => [r.line, r.from, r.to, r.status, r.outcome]);
    expect(brief).toEqual([
      [2, '/قدیمی/صفحه-اول', '/خدمات', '301', 'new'],
      [3, '/قدیمی/دوم', '/پزشکان', '301', 'new'],
      [4, '/قدیمی/عربی', '/مقالات', '301', 'new'],
      [5, '/old/quoted,comma', '/خدمات', '301', 'new'],
      [6, '/old/gone', null, '410', 'new'],
      [7, '/old/gone-fa', null, '410', 'new'],
      [8, '/old/page?id=7', '/خدمات', '301', 'refused'],
      [9, 'https://other.example/x', '/خدمات', '301', 'refused'],
      [10, '/api/old', '/خدمات', '301', 'refused'],
      [11, '/vip', '/خدمات', '301', 'refused'],
      [12, '/خدمات', '/پزشکان', '301', 'refused'],
      [13, '/old/dup', '/خدمات', '301', 'new'],
      [14, '/old/dup', '/پزشکان', '301', 'refused'],
      [15, '/old/loop-a', '/old/loop-b', '301', 'new'],
      [16, '/old/loop-b', '/old/loop-a', '301', 'refused'],
      [17, '/old/chain-a', '/مقالات', '301', 'new'],
      [18, '/old/chain-b', '/مقالات', '301', 'new'],
      [19, '/old/dead', '/خدمات/خدمت-ناموجود', '301', 'new'],
      [20, '/old/self', '/old/self', '301', 'refused'],
      [21, '/old/temporary', '/خدمات', '302', 'refused'],
    ]);
    const note = (line: number) => plan.rows.find((r) => r.line === line)?.note;
    expect(note(8)).toBe(
      'نیاز به نگاشت دستی: نشانی پارامتر دارد (بخش بعد از «?») و سایت فقط مسیر را می‌سنجد. برای مسیر بدون پارامتر یک ردیف جدا بنویسید.',
    );
    expect(plan.rows.find((r) => r.line === 8)?.manual).toBe(true);
    expect(note(9)).toBe('دامنهٔ other.example در فهرست دامنه‌های سایت قبلی نیست.');
    expect(note(10)).toBe(SYSTEM_PATH_NOTE);
    expect(note(11)).toBe(
      'برای این نشانی یک تغییر مسیر دیگر (نه از فایل) ثبت شده است. آن را در همین فهرست ویرایش کنید.',
    );
    expect(note(12)).toBe('این نشانی صفحهٔ منتشرشدهٔ سایت است و تغییر مسیر آن را پنهان می‌کند.');
    expect(note(14)).toBe('این نشانی قدیمی در سطر ۱۳ هم آمده است.');
    expect(note(15)).toBe(
      'هشدار: مقصد صفحهٔ منتشرشده‌ای نیست و بازدیدکننده به صفحهٔ «پیدا نشد» می‌رسد.',
    );
    expect(note(16)).toBe('این انتقال به خودش برمی‌گردد. مقصد دیگری انتخاب کنید.');
    expect(note(19)).toBe(note(15));
    expect(note(20)).toBe('مبدأ و مقصد یکی است.');
    expect(note(21)).toBe('کد انتقال فقط ۳۰۱ یا ۴۱۰ است.');
    for (const line of [2, 3, 4, 5, 6, 7, 13, 17, 18])
      expect(note(line), String(line)).toBeUndefined();
  });

  it('IC5b the admin route is a system path, as source and as destination; the old /admin is an ordinary old URL now', () => {
    const plan = planImport(
      `${ADMIN_ROUTE}/x,/خدمات\n/admin/x,/خدمات\n/old,${ADMIN_ROUTE}`,
      context(),
    );
    expect(plan.rows.map((r) => [r.from, r.outcome, r.note])).toEqual([
      [`${ADMIN_ROUTE}/x`, 'refused', SYSTEM_PATH_NOTE],
      ['/admin/x', 'new', undefined],
      ['/old', 'refused', 'مقصد نمی‌تواند نشانی سیستمی باشد.'],
    ]);
  });

  it('IC6 a rerun against what the first run wrote is all unchanged; a new target is an update', () => {
    const text = '/a,/خدمات\n/b,/c\n/c,/پزشکان\n/d,,410';
    const written = existing({
      '/a': { to: '/خدمات', statusCode: '301', source: 'import', active: true },
      '/b': { to: '/پزشکان', statusCode: '301', source: 'import', active: true },
      '/c': { to: '/پزشکان', statusCode: '301', source: 'import', active: true },
      '/d': { to: null, statusCode: '410', source: 'import', active: true },
    });
    const again = planImport(text, context({ existing: written, activeCount: 4 }));
    expect(again.rows.map((r) => r.outcome)).toEqual([
      'unchanged',
      'unchanged',
      'unchanged',
      'unchanged',
    ]);
    const changed = planImport(
      '/a,/مقالات\n/d,/خدمات',
      context({ existing: written, activeCount: 4 }),
    );
    expect(changed.rows.map((r) => [r.outcome, r.id])).toEqual([
      ['update', 1],
      ['update', 4],
    ]);
    // A switched-off import row is switched on again by the file: an update.
    const off = existing({
      '/a': { to: '/خدمات', statusCode: '301', source: 'import', active: false },
    });
    expect(planImport('/a,/خدمات', context({ existing: off })).rows[0]?.outcome).toBe('update');
  });

  it('IC7 C27: a slug-change, alias or manual row is never overwritten', () => {
    for (const source of ['slug_change', 'alias', 'manual', 'auto_removed']) {
      const rows = existing({ '/x': { to: '/خدمات', statusCode: '301', source, active: false } });
      expect(planImport('/x,/خدمات', context({ existing: rows })).rows[0]?.outcome).toBe('refused');
    }
  });

  it('IC8 chains flatten through the file and the table, keeping an anchor; loops through the table are refused', () => {
    const table = existing({
      '/t': {
        to: '/خدمات/ترمیم-دندان#سطح-ترمیم',
        statusCode: '301',
        source: 'manual',
        active: true,
      },
      '/u': { to: '/w', statusCode: '301', source: 'manual', active: true },
    });
    const plan = planImport('/a,/t\n/b,/u2\n/w,/b', context({ existing: table, activeCount: 2 }));
    expect(plan.rows.map((r) => [r.from, r.to, r.outcome])).toEqual([
      ['/a', '/خدمات/ترمیم-دندان#سطح-ترمیم', 'new'],
      ['/b', '/u2', 'new'],
      ['/w', '/u2', 'new'],
    ]);
    const loop = planImport('/w,/u', context({ existing: table, activeCount: 2 }));
    expect(loop.rows[0]).toMatchObject({ outcome: 'refused', to: '/u' });
  });

  it('IC9 more than five rows to the home page: each carries the warning', () => {
    const text = Array.from({ length: 6 }, (_, i) => `/h${i},/`).join('\n');
    const plan = planImport(text, context());
    expect(plan.rows.every((r) => r.outcome === 'new')).toBe(true);
    expect(new Set(plan.rows.map((r) => r.note))).toEqual(
      new Set([
        'هشدار: بیش از ۵ ردیف به صفحهٔ خانه می‌رود. گوگل این‌ها را صفحهٔ خطا می‌شمارد؛ مقصد نزدیک‌تری بنویسید.',
      ]),
    );
    expect(
      planImport(text.split('\n').slice(1).join('\n'), context()).rows[0]?.note,
    ).toBeUndefined();
  });

  it('IC10 caps: rows in the file and active rows after the import', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `/r${i},/خدمات`).join('\n');
    expect(planImport(rows(4), context({ cap: 3 }))).toEqual({
      rows: [],
      error: 'فایل بیش از ۳ ردیف دارد. آن را به چند فایل کوچک‌تر تقسیم کنید.',
    });
    const over = planImport(rows(2), context({ cap: 3, activeCount: 2 }));
    expect(over.error).toBe(
      'با این فایل، تغییر مسیرهای فعال به ۴ می‌رسد و سقف ۳ است. ردیف‌های بی‌استفاده را غیرفعال کنید یا فایل را کوچک‌تر کنید.',
    );
    expect(over.rows).toHaveLength(2);
    expect(planImport(rows(1), context({ cap: 3, activeCount: 2 })).error).toBeUndefined();
    expect(planImport('', context())).toEqual({ rows: [], error: 'فایل ردیفی ندارد.' });
  });

  it('IC11 tolerant input: Persian status digits, spaces, `//host` URLs, a target on an old origin', () => {
    const plan = planImport(
      ' //old-sefid.ir/a/ , https://OLD-SEFID.ir/خدمات#x , ۳۰۱ \n/b,/پزشکان,',
      context(),
    );
    expect(plan.rows.map((r) => [r.from, r.to, r.status, r.outcome])).toEqual([
      ['/a', '/خدمات#x', '301', 'new'],
      ['/b', '/پزشکان', '301', 'new'],
    ]);
  });

  it('IC13 a file Excel saved with «؛» or «;» (Persian or other regional settings) plans like a comma file', () => {
    for (const sep of ['؛', ';']) {
      const rows = [
        ['from', 'to', 'status'],
        ['/a', '/خدمات', '301'],
        ['/b', '', '410'],
      ];
      const plan = planImport(rows.map((r) => r.join(sep)).join('\r\n'), context());
      expect(plan.rows.map((r) => [r.from, r.to, r.status, r.outcome])).toEqual([
        ['/a', '/خدمات', '301', 'new'],
        ['/b', null, '410', 'new'],
      ]);
    }
  });
});
