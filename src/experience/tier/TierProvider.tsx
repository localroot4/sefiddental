'use client';

/**
 * Tier provider (spec EXP 3.5): owns no selection logic. It creates the tier store on the client,
 * exposes its snapshot through context, and mirrors the effective tier to `html[data-tier]` and
 * `html[data-tier-reason]` after hydration (absent = tier 0 styles; the server HTML is tier-0-safe).
 */
import { createContext, use, useEffect, useState, useSyncExternalStore } from 'react';

import type { Tier } from '@/lib/qualityTier';

import { createBrowserTierEnv } from './browserEnv';
import { createTierStore, SERVER_TIER_STATE, type TierState, type TierStore } from './tierStore';

const TierStateContext = createContext<TierState | null>(null);
const TierStoreContext = createContext<TierStore | null>(null);

const noopSubscribe = (): (() => void) => () => {};
const serverSnapshot = (): TierState => SERVER_TIER_STATE;

export function TierProvider(props: {
  siteCap: Tier | null;
  children: React.ReactNode;
}): React.JSX.Element {
  // Client only: the server and the hydration pass use the tier 0 server snapshot.
  const [store] = useState<TierStore | null>(() =>
    typeof window === 'undefined'
      ? null
      : createTierStore(createBrowserTierEnv(), { siteCap: props.siteCap }),
  );
  const state = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? serverSnapshot,
    serverSnapshot,
  );

  useEffect(() => {
    if (!state.hydrated) return;
    const html = document.documentElement;
    html.dataset.tier = String(state.tier);
    html.dataset.tierReason = state.reason;
  }, [state.hydrated, state.tier, state.reason]);

  useEffect(
    () => () => {
      const html = document.documentElement;
      delete html.dataset.tier;
      delete html.dataset.tierReason;
    },
    [],
  );

  return (
    <TierStoreContext value={store}>
      <TierStateContext value={state}>{props.children}</TierStateContext>
    </TierStoreContext>
  );
}

export function useTier(): TierState {
  const state = use(TierStateContext);
  if (state === null) {
    throw new Error('useTier() needs a <TierProvider> above it (rendered by ExperienceRoot).');
  }
  return state;
}

/** The store itself, for the scroll engine to register its latch inputs; null on the server. */
export function useTierStore(): TierStore | null {
  return use(TierStoreContext);
}
