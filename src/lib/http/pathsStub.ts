/**
 * Local stub of `normalizePath` from `src/lib/paths.ts` (Lane D, freeze 3.9), same signature and
 * rules, so the platform modules and their tests run before Lane D merges. At merge: delete this
 * file and import `normalizePath` from '@/lib/paths' in classify.ts, canonical.ts and the tests.
 *
 * Rules: drop query and fragment; decode runs of %XX (a run that is not valid UTF-8 is kept as
 * is, never throws); NFC; Arabic yeh, alef maksura and kaf to Persian yeh and kaf; collapse '//';
 * drop trailing '/' except '/'; lowercase ASCII letters only. Output is decoded Unicode.
 */
export function normalizePath(input: string): string {
  const cut = input.search(/[?#]/);
  const raw = cut === -1 ? input : input.slice(0, cut);
  const decoded = raw.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
  const letters = decoded.normalize('NFC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
  const single = letters.replace(/\/{2,}/g, '/');
  const trimmed = single.length > 1 ? single.replace(/\/+$/, '') : single;
  const lower = trimmed.replace(/[A-Z]/g, (c) => c.toLowerCase());
  return lower === '' ? '/' : lower;
}
