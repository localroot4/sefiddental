/**
 * Home query parameters (freeze 3.14): `debug=1|0`, `tier=0..3`, `monitor=1`, `stress=1..8`.
 * ASCII digits only; anything else is ignored. Read once per page load from
 * `window.location.search` inside client code, never through `useSearchParams`.
 */
import type { Tier } from '@/lib/qualityTier';

export interface ExperienceQuery {
  /** 'on' for `debug=1`, 'off' for `debug=0`, null when absent or malformed. */
  debug: 'on' | 'off' | null;
  /** `tier=N`: a fixed tier, or the starting tier of an auto run with `monitor=1`. */
  tier: Tier | null;
  /** `monitor=1`: the frame monitor stays active under `tier=N`. */
  monitor: boolean;
  /** `stress=N` (1..8), honoured only with the debug flag; 0 when absent. */
  stress: number;
}

export function parseExperienceQuery(search: string): ExperienceQuery {
  const params = new URLSearchParams(search);
  const debug = params.get('debug');
  const tier = params.get('tier');
  const stress = params.get('stress');
  return {
    debug: debug === '1' ? 'on' : debug === '0' ? 'off' : null,
    tier: tier !== null && /^[0-3]$/.test(tier) ? (Number(tier) as Tier) : null,
    monitor: params.get('monitor') === '1',
    stress: stress !== null && /^[1-8]$/.test(stress) ? Number(stress) : 0,
  };
}

/** `debug=1` turns the session flag on, `debug=0` off; without the parameter the flag decides. */
export function debugActive(query: ExperienceQuery, sessionFlag: string | null): boolean {
  if (query.debug !== null) return query.debug === 'on';
  return sessionFlag === '1';
}
