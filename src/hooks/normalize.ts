import { BLOCK_PROSE } from '@/fields/validators';
import { normalizeProse, normalizeRuns } from '@/lib/persianProse';
import { normalizePersian } from '@/lib/persianText';

/**
 * H-NORM (spec-data 6.2, freeze decision 34, H9): Persian normalization of the listed fields
 * before validation. `prose` gets editorial typography spacing and quote pairs, `names` only the
 * default collapse. Paths are dotted; `*` walks every array row ('faqs.*.answer'). A text field
 * with hasMany is an array of strings and is normalized item by item; a rich-text value (Lexical
 * state) is walked node by node. Never slugs, keys, phones, URLs or codes.
 */
export interface NormalizeSpec {
  prose?: readonly string[];
  names?: readonly string[];
  /** C32: ASCII digits in prose become Persian; content collections only, never money terms. */
  persianDigits?: boolean;
}

type Normalizer = (value: string) => string;
type Leaf = (value: unknown) => unknown;
type Node = Record<string, unknown> & { type?: unknown; text?: unknown; children?: unknown };

const NAMES: Normalizer = (v) => normalizePersian(v);
// Inline elements: their text continues the surrounding sentence.
const INLINE = new Set(['link', 'autolink']);

const isObject = (value: unknown): value is Node => typeof value === 'object' && value !== null;
const isLexical = (value: unknown): value is { root: unknown } =>
  isObject(value) && !Array.isArray(value) && isObject(value.root);

function apply(node: unknown, segments: readonly string[], leaf: Leaf): unknown {
  if (segments.length === 0) return leaf(node);
  const [head, ...rest] = segments as [string, ...string[]];
  if (head === '*') {
    return Array.isArray(node) ? node.map((item) => apply(item, rest, leaf)) : node;
  }
  if (!isObject(node) || Array.isArray(node)) return node;
  if (!(head in node)) return node;
  return { ...node, [head]: apply(node[head], rest, leaf) };
}

const strings =
  (fn: Normalizer): Leaf =>
  (value) => {
    if (typeof value === 'string') return fn(value);
    if (Array.isArray(value))
      return value.map((item) => (typeof item === 'string' ? fn(item) : item));
    return value;
  };

/**
 * A copy of a Lexical state with every run of inline text normalized as one text (H9), and the
 * prose fields of article blocks normalized as fields. Element nodes keep their shape and keys.
 */
function normalizeLexical(state: { root: unknown }, digits: boolean, prose: Leaf): unknown {
  const copy = structuredClone(state);
  const visit = (node: unknown): void => {
    if (!isObject(node)) return;
    if (node.type === 'block' && isObject(node.fields)) {
      let fields: unknown = node.fields;
      for (const path of BLOCK_PROSE[String(node.fields.blockType)] ?? []) {
        fields = apply(fields, path.split('.'), prose);
      }
      node.fields = fields;
    }
    if (!Array.isArray(node.children)) {
      if (isObject(node.root)) visit(node.root);
      return;
    }
    let run: Node[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const out = normalizeRuns(
        run.map((n) => n.text as string),
        { digits: digits ? 'prose' : 'keep' },
      );
      run.forEach((n, i) => {
        n.text = out[i];
      });
      run = [];
    };
    const inline = (children: unknown[]) => {
      for (const child of children) {
        if (isObject(child) && child.type === 'text' && typeof child.text === 'string') {
          run.push(child);
        } else if (
          isObject(child) &&
          INLINE.has(String(child.type)) &&
          Array.isArray(child.children)
        ) {
          inline(child.children);
        } else {
          flush();
          visit(child);
        }
      }
    };
    inline(node.children);
    flush();
  };
  visit(copy.root);
  return copy;
}

/** Pure: a copy of `data` with the listed paths normalized. Idempotent. */
export function normalizeData<T>(data: T, spec: NormalizeSpec): T {
  const digits = Boolean(spec.persianDigits);
  const proseText = strings((v) => normalizeProse(v, { digits }));
  const prose: Leaf = (value) =>
    isLexical(value) ? normalizeLexical(value, digits, proseText) : proseText(value);
  let out: unknown = data;
  for (const path of spec.prose ?? []) out = apply(out, path.split('.'), prose);
  for (const path of spec.names ?? []) out = apply(out, path.split('.'), strings(NAMES));
  return out as T;
}

/** The hook for collections and globals (`beforeValidate`). */
export const normalizeFields =
  (spec: NormalizeSpec) =>
  <T>({ data }: { data?: T }): T | undefined =>
    data === undefined ? data : normalizeData(data, spec);
