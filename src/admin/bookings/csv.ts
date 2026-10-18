import { ADMIN_MESSAGES as M } from '@/i18n/fa-admin';
import { formatJalali, formatTimeFa } from '@/lib/jalali';
import { toLatinDigits } from '@/lib/persianText';

/** D-8: one file holds at most this many requests; a clinic writes a few a day. */
export const CSV_MAX_ROWS = 10_000;

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

type Doc = Record<string, unknown>;
interface OptionField {
  name: string;
  options?: ReadonlyArray<string | { label: unknown; value: string }>;
}

/**
 * RFC 4180 cell, always quoted. Formula guard: spreadsheet apps run a cell that starts with
 * = + - @ tab or CR, so such text gets a leading apostrophe. Bidi controls are dropped: they
 * would reorder what the cell shows.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value).replace(BIDI_CONTROLS, '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** UTF-8 BOM first (Excel then reads Persian), CRLF line ends. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Tehran Jalali 'yyyy/MM/dd HH:mm' with Latin digits (spreadsheets sort it as text). */
function tehranStamp(iso: unknown): string {
  const at = typeof iso === 'string' ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  return toLatinDigits(`${formatJalali(at, 'yyyy/MM/dd')} ${formatTimeFa(at)}`);
}

/**
 * «0912 345 6789»: spreadsheet apps read a bare 09123456789 as a number and drop the 0, whatever
 * the quoting; the spaces keep it text. Strip spaces to import the numbers elsewhere.
 */
const spacedPhone = (national: unknown): unknown =>
  typeof national === 'string' ? national.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3') : national;

const titleOf = (value: unknown, key: string): unknown =>
  value && typeof value === 'object' ? (value as Doc)[key] : value;

type Labels = (field: string, value: unknown) => string;

const UTM = ['source', 'medium', 'campaign', 'term', 'content'] as const;

/** Column order and Persian headers (admin-notify.md 4.8); never the IP hash or staff notes. */
const COLUMNS: ReadonlyArray<readonly [string, (doc: Doc, label: Labels) => unknown]> = [
  [M['admin.csv.col.id'], (d) => d.id],
  [M['admin.csv.col.createdAtUtc'], (d) => d.createdAt],
  [M['admin.csv.col.createdAt'], (d) => tehranStamp(d.createdAt)],
  [M['admin.csv.col.kind'], (d, l) => l('kind', d.kind)],
  [M['admin.csv.col.status'], (d, l) => l('status', d.status)],
  [M['admin.csv.col.phone'], (d) => spacedPhone(d.phoneNational)],
  [M['admin.csv.col.name'], (d) => d.name],
  [M['admin.csv.col.group'], (d, l) => l('bookingGroup', d.bookingGroup)],
  [M['admin.csv.col.service'], (d) => titleOf(d.service, 'navLabel')],
  [M['admin.csv.col.serviceKey'], (d) => d.serviceKey],
  [M['admin.csv.col.tier'], (d) => d.tier],
  [M['admin.csv.col.doctor'], (d) => titleOf(d.doctor, 'name')],
  [M['admin.csv.col.preferredTime'], (d, l) => l('preferredTime', d.preferredTime)],
  [M['admin.csv.col.note'], (d) => d.note],
  [M['admin.csv.col.triage'], (d, l) => l('triage', d.triage)],
  [M['admin.csv.col.outcome'], (d, l) => l('emergencyOutcome', d.emergencyOutcome)],
  [M['admin.csv.col.heardFrom'], (d, l) => l('heardFrom', d.heardFrom)],
  [M['admin.csv.col.formLocation'], (d, l) => l('formLocation', d.formLocation)],
  [M['admin.csv.col.sourceUrl'], (d) => d.sourceUrl],
  ...UTM.map(
    (key) => [`utm_${key}`, (d: Doc) => (d.utm as Doc | null | undefined)?.[key]] as const,
  ),
  [M['admin.csv.col.device'], (d, l) => l('device', d.device)],
  [M['admin.csv.col.callbackDueAt'], (d) => tehranStamp(d.callbackDueAt)],
  [M['admin.csv.col.handledBy'], (d) => titleOf(d.handledBy, 'name')],
  [M['admin.csv.col.handledAt'], (d) => tehranStamp(d.handledAt)],
  [M['admin.csv.col.flags'], (d, l) => l('flags', d.flags)],
  [
    M['admin.csv.col.duplicates'],
    (d) => (Array.isArray(d.duplicateSubmissions) ? d.duplicateSubmissions.length : 0),
  ],
];

/** Select values as the labels staff see in the panel (several joined with «، »). */
function labelsFrom(fields: readonly OptionField[]): Labels {
  const byField = new Map(
    fields.map((field) => [
      field.name,
      new Map(
        (field.options ?? []).map((option) =>
          typeof option === 'string'
            ? [option, option]
            : [option.value, typeof option.label === 'string' ? option.label : option.value],
        ),
      ),
    ]),
  );
  return (field, value) => {
    const labels = byField.get(field);
    const one = (v: unknown) => (typeof v === 'string' ? (labels?.get(v) ?? v) : '');
    return Array.isArray(value) ? value.map(one).join('، ') : one(value);
  };
}

/** The whole file for booking rows read at depth 1 (service, doctor and handler names). */
export function bookingsCsv(docs: readonly Doc[], fields: readonly OptionField[]): string {
  const label = labelsFrom(fields);
  return toCsv([
    COLUMNS.map(([header]) => header),
    ...docs.map((doc) => COLUMNS.map(([, value]) => value(doc, label))),
  ]);
}
