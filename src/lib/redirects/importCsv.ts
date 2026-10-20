/**
 * The old-URL CSV import (phase 6 H19, plan section 6): parse the file, then decide per row what
 * a write would do, with the same normalization and field rules the redirects collection runs.
 * Pure: the endpoint passes the table, the live paths and the cap, shows the plan as the dry run
 * and writes the same plan on apply.
 */
import { fromRule, LOOP_MESSAGE, normalizeTarget, toRule, withFragment } from '@/hooks/redirects';
import { redirectsText } from '@/i18n/fa-redirects';
import { normalizePath } from '@/lib/paths';
import { formatNumberFa, toLatinDigits } from '@/lib/persianText';

const fa = (n: number) => formatNumberFa(n);

export interface CsvRecord {
  /** The file line where the record starts (a quoted cell may span lines). */
  line: number;
  cells: string[];
}

// Excel writes the regional list separator: «؛» under Persian settings, «;» in many locales.
const SEPARATORS = ',;؛\t';

/** The separator used most outside quotes on the first line that has one; a tie keeps the comma. */
function separatorOf(body: string): string {
  const counts = new Map<string, number>();
  let quoted = false;
  for (const c of body) {
    if (c === '"') quoted = !quoted;
    else if (quoted) continue;
    else if ((c === '\n' || c === '\r') && counts.size > 0) break;
    else if (SEPARATORS.includes(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...SEPARATORS].reduce((best, sep) =>
    (counts.get(sep) ?? 0) > (counts.get(best) ?? 0) ? sep : best,
  );
}

/**
 * RFC 4180 with what spreadsheets add: a BOM, CRLF or LF, spaces around cells, blank lines, and
 * a regional separator in place of the comma.
 */
export function parseCsv(text: string): { records: CsvRecord[] } | { error: string } {
  // A file saved in a legacy encoding reaches here with replacement characters.
  if (text.includes('\uFFFD')) return { error: redirectsText('redirects.import.encoding') };
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  const endCell = () => {
    cells.push(cell.trim());
    cell = '';
  };
  const endRecord = () => {
    endCell();
    if (cells.some((c) => c !== '')) records.push({ line: start, cells });
    cells = [];
  };
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const separator = separatorOf(body);
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else {
        if (c === '\n') line += 1;
        cell += c;
      }
    } else if (c === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (c === separator) endCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i += 1;
      endRecord();
      line += 1;
      start = line;
    } else cell += c;
  }
  if (quoted)
    return { error: redirectsText('redirects.import.unclosedQuote', { line: fa(start) }) };
  endRecord();
  return { records };
}

// `scheme://host…` or `//host…`: the host (no user, port or www.) and the rest as typed.
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#]*)(.*)$/is;

function hostOf(authority: string): string {
  return authority
    .replace(/^.*@/, '')
    .replace(/:\d*$/, '')
    .toLowerCase()
    .replace(/^www\./, '');
}

/** Host names from what the admin typed: URLs or bare names, commas (Persian or Latin) or spaces. */
export function parseOrigins(input: string): string[] {
  return input
    .split(/[\s,،]+/)
    .filter(Boolean)
    .map((value) => hostOf(ABSOLUTE.exec(value)?.[1] ?? value.split(/[/?#]/)[0]!));
}

export interface ExistingRedirect {
  id: number | string;
  to: string | null;
  statusCode: string;
  source: string;
  active: boolean;
}

export interface PlanContext {
  /** Old-site host names; an absolute URL on one of them becomes its path. */
  origins: readonly string[];
  /** Every redirect row, by its normalized `from`. */
  existing: ReadonlyMap<string, ExistingRedirect>;
  /** Active rows in the table now. */
  activeCount: number;
  /** A published page or a hub answers this normalized path. */
  isLive: (path: string) => boolean;
  /** Active rows the proxy snapshot keeps (REDIRECTS_SNAPSHOT_MAX); also the most rows a file has. */
  cap: number;
}

export type Outcome = 'new' | 'update' | 'unchanged' | 'refused';

export interface PlanRow {
  line: number;
  from: string;
  /** The final target after chains are followed; null for a 410. */
  to: string | null;
  status: string;
  outcome: Outcome;
  /** Why the row is refused, or a warning on a row that is written. */
  note?: string;
  /** A `from` with a query string: the admin maps it by hand. */
  manual?: true;
  /** The import row an update rewrites. */
  id?: number | string;
}

export interface ImportPlan {
  rows: PlanRow[];
  /** The whole file is refused (nothing is written). */
  error?: string;
}

const HOME_WARNING_OVER = 5;

/** A cell as a site path: an absolute URL on a named origin loses its origin. */
function localPath(value: string, origins: readonly string[]): { path: string } | { host: string } {
  const match = ABSOLUTE.exec(value);
  if (!match) return { path: value };
  const host = hostOf(match[1]!);
  return origins.includes(host) ? { path: match[2] || '/' } : { host };
}

/**
 * One outcome per data row. Rows are decided in file order, as the writes run: a row whose target
 * chain comes back to its own `from` is refused (the second row of a loop). Accepted rows show
 * their final target, which the redirect hooks store after flattening and repointing.
 */
export function planImport(text: string, context: PlanContext): ImportPlan {
  const parsed = parseCsv(text);
  if ('error' in parsed) return { rows: [], error: parsed.error };
  // A first record without a slash in its first cell is the header (paths and URLs have one).
  const records = parsed.records.filter((r, i) => i > 0 || r.cells[0]!.includes('/'));
  if (records.length === 0) return { rows: [], error: redirectsText('redirects.import.empty') };
  if (records.length > context.cap) {
    return {
      rows: [],
      error: redirectsText('redirects.import.tooManyRows', { max: fa(context.cap) }),
    };
  }

  // Active targets by `from`: the table, then each accepted row of the file in order.
  const targets = new Map<string, string | null>();
  for (const [from, row] of context.existing) if (row.active) targets.set(from, row.to);
  /** The end of the chain from `to`, or null when it comes back to `from`. */
  const resolve = (from: string, to: string): string | null => {
    const seen = new Set([from]);
    let current = to;
    for (;;) {
      const path = normalizePath(current);
      if (seen.has(path)) return null;
      const next = targets.get(path);
      if (!next) return current;
      seen.add(path);
      current = withFragment(next, current);
    }
  };

  const firstLine = new Map<string, number>();
  const rows: PlanRow[] = records.map(({ line, cells }) => {
    const [rawFrom = '', rawTo = '', rawStatus = ''] = cells;
    const status = toLatinDigits(rawStatus) || '301';
    const source = localPath(rawFrom, context.origins);
    const target = localPath(rawTo, context.origins);
    let to: string | null = status === '410' ? null : 'path' in target ? target.path : rawTo;
    if (to?.startsWith('/')) to = normalizeTarget(to);
    const refuse = (from: string, note: string, extra: Partial<PlanRow> = {}): PlanRow => ({
      line,
      from,
      to,
      status,
      outcome: 'refused',
      note,
      ...extra,
    });

    if ('host' in source) {
      return refuse(rawFrom, redirectsText('redirects.import.origin', { host: source.host }));
    }
    if (source.path.includes('?')) {
      return refuse(source.path, redirectsText('redirects.import.query'), { manual: true });
    }
    const from = normalizePath(source.path);
    if (status !== '301' && status !== '410') {
      return refuse(from, redirectsText('redirects.import.status'));
    }
    const rule = [fromRule(from, { data: { to } }), toRule(to, { data: { statusCode: status } })];
    const problem = rule.find((r): r is string => r !== true);
    if (problem) return refuse(from, problem);
    const earlier = firstLine.get(from);
    if (earlier !== undefined) {
      return refuse(from, redirectsText('redirects.import.duplicate', { line: fa(earlier) }));
    }
    firstLine.set(from, line);
    const existing = context.existing.get(from);
    if (existing && existing.source !== 'import') {
      return refuse(from, redirectsText('redirects.import.notImport'));
    }
    if (context.isLive(from)) return refuse(from, redirectsText('redirects.import.live'));
    if (to !== null && resolve(from, to) === null) return refuse(from, LOOP_MESSAGE);
    targets.set(from, to);
    return { line, from, to, status, outcome: 'new' };
  });

  // Final targets once every accepted row is known, then the outcome against the table.
  const accepted = rows.filter((r) => r.outcome !== 'refused');
  for (const row of accepted) {
    if (row.to !== null) row.to = resolve(row.from, row.to) ?? row.to;
    const existing = context.existing.get(row.from);
    if (existing) {
      const same = existing.active && existing.statusCode === row.status && existing.to === row.to;
      row.outcome = same ? 'unchanged' : 'update';
      row.id = existing.id;
    }
  }
  const home = accepted.filter((r) => r.to === '/').length;
  for (const row of accepted) {
    if (row.to === null) continue;
    if (row.to === '/' && home > HOME_WARNING_OVER) {
      row.note = redirectsText('redirects.import.manyHome');
    } else if (!context.isLive(normalizePath(row.to))) {
      row.note = redirectsText('redirects.import.deadTarget');
    }
  }

  // The snapshot keeps `cap` active rows: a file that would push the table past it is refused.
  const added = accepted.filter((r) => !context.existing.get(r.from)?.active).length;
  const total = context.activeCount + added;
  if (total > context.cap) {
    return {
      rows,
      error: redirectsText('redirects.import.overCap', { total: fa(total), max: fa(context.cap) }),
    };
  }
  return { rows };
}
