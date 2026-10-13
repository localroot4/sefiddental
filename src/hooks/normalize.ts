import { normalizePersian } from '@/lib/persianText';

/**
 * H-NORM (spec-data 6.2, freeze decision 34): Persian normalization of the listed fields before
 * validation. `prose` gets editorial typography spacing, `names` only the default collapse.
 * Paths are dotted; `*` walks every array row ('faqs.*.answer'). A text field with hasMany is
 * an array of strings and is normalized item by item. Never slugs, keys, phones, URLs or codes.
 */
export interface NormalizeSpec {
  prose?: readonly string[];
  names?: readonly string[];
}

type Normalizer = (value: string) => string;

const PROSE: Normalizer = (v) => normalizePersian(v, { spacing: 'typography' });
const NAMES: Normalizer = (v) => normalizePersian(v);

function apply(node: unknown, segments: readonly string[], fn: Normalizer): unknown {
  if (segments.length === 0) {
    if (typeof node === 'string') return fn(node);
    if (Array.isArray(node))
      return node.map((item) => (typeof item === 'string' ? fn(item) : item));
    return node;
  }
  const [head, ...rest] = segments as [string, ...string[]];
  if (head === '*') {
    return Array.isArray(node) ? node.map((item) => apply(item, rest, fn)) : node;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return node;
  const record = node as Record<string, unknown>;
  if (!(head in record)) return node;
  return { ...record, [head]: apply(record[head], rest, fn) };
}

/** Pure: a copy of `data` with the listed paths normalized. Idempotent. */
export function normalizeData<T>(data: T, spec: NormalizeSpec): T {
  let out: unknown = data;
  for (const path of spec.prose ?? []) out = apply(out, path.split('.'), PROSE);
  for (const path of spec.names ?? []) out = apply(out, path.split('.'), NAMES);
  return out as T;
}

/** The hook for collections and globals (`beforeValidate`). */
export const normalizeFields =
  (spec: NormalizeSpec) =>
  <T>({ data }: { data?: T }): T | undefined =>
    data === undefined ? data : normalizeData(data, spec);
