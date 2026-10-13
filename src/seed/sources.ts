import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isPair, isScalar, isSeq, LineCounter, parseDocument, visit, type Document } from 'yaml';
import type { z } from 'zod';

/**
 * YAML sources of the seeders (spec-data 8.1, 9.1). `parseDocument` keeps comments, so the
 * `# NEEDS_CLIENT` and `# verify` markers are read from the nodes; every file is validated with
 * zod before any write, and a bad value stops the run with `file:line`.
 */

export type MarkerKind = 'needs_client' | 'needs_verification';

export interface YamlMarker {
  /** Repository-relative file, e.g. 'docs/content/clinic.yaml'. */
  file: string;
  /** Dotted data path with array indices, e.g. 'financing.0.provider'. */
  path: string;
  kind: MarkerKind;
  line: number;
}

export interface YamlSource<T> {
  file: string;
  data: T;
  markers: YamlMarker[];
  /** 1-based line of a data path (for template-skip and error reports); 0 when unknown. */
  lineOf(path: readonly (string | number)[]): number;
}

function markerKind(comment: string): MarkerKind | null {
  if (/NEEDS_CLIENT/.test(comment)) return 'needs_client';
  if (/(^|\s)verify\b/i.test(comment)) return 'needs_verification';
  return null;
}

function collectMarkers(doc: Document, file: string, lines: LineCounter): YamlMarker[] {
  const markers: YamlMarker[] = [];
  visit(doc, {
    Pair(_, pair, ancestors) {
      if (!isScalar(pair.key)) return;
      const value = pair.value as { comment?: string | null; commentBefore?: string | null } | null;
      // A trailing comment sits on the value; a comment after `key:` of a map on its commentBefore.
      const kind = markerKind(`${value?.comment ?? ''} ${value?.commentBefore ?? ''}`);
      if (!kind) return;
      const parts: string[] = [];
      ancestors.forEach((node, index) => {
        if (isPair(node) && isScalar(node.key)) parts.push(String(node.key.value));
        if (isSeq(node)) parts.push(String(node.items.indexOf(ancestors[index + 1] as never)));
      });
      parts.push(String(pair.key.value));
      const offset = pair.key.range?.[0] ?? 0;
      markers.push({ file, path: parts.join('.'), kind, line: lines.linePos(offset).line });
    },
  });
  return markers;
}

export class SeedSourceError extends Error {}

/** Reads, parses and validates one YAML file; throws `SeedSourceError` with `file:line`. */
export function readYaml<S extends z.ZodType>(
  root: string,
  file: string,
  schema: S,
): YamlSource<z.infer<S>> {
  const text = readFileSync(path.join(root, file), 'utf8');
  const lines = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lines });
  const lineOf = (dataPath: readonly (string | number)[]): number => {
    const node = doc.getIn(dataPath, true) as { range?: [number, number, number] } | undefined;
    return node?.range ? lines.linePos(node.range[0]).line : 0;
  };
  if (doc.errors.length > 0) {
    const error = doc.errors[0];
    const line = error?.linePos?.[0]?.line ?? 0;
    throw new SeedSourceError(`${file}:${line}: ${error?.message ?? 'YAML parse error'}`);
  }
  const parsed = schema.safeParse(doc.toJS());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = (issue?.path ?? []) as (string | number)[];
    // The deepest existing node on the issue path gives the line.
    let line = 0;
    for (let n = issuePath.length; n >= 0 && line === 0; n -= 1)
      line = lineOf(issuePath.slice(0, n));
    throw new SeedSourceError(
      `${file}:${line}: ${issuePath.join('.') || '(root)'}: ${issue?.message ?? 'invalid'}`,
    );
  }
  return { file, data: parsed.data, markers: collectMarkers(doc, file, lines), lineOf };
}
