'use client';

/**
 * Home experience root (spec EXP 3.3, freeze 3.14), rendered only by the home page. The server
 * HTML is the tier-0 page; after hydration it latches the layout; after `load` it runs the scroll
 * engine and mounts the canvas (after the intro and on idle, at tier 1 or more). The developer
 * overlay loads only under the debug flag.
 */
import 'lenis/dist/lenis.css';

import { useEffect, useRef, useState } from 'react';

import type { Tier } from '@/lib/qualityTier';

import { onIdle, useDocumentLoaded, useDocumentVisible, useIntroDone } from './core/browserSignals';
import { canMount } from './core/gates';
import { createFrameRuntime, createStore, useStore, type ExperienceState } from './core/store';
import { SCENES } from './scenes/registry';
import { TierProvider, useTier, useTierStore } from './tier/TierProvider';

/** The canvas mounts in an idle callback, at the latest this long after the gates open. */
const MOUNT_IDLE_TIMEOUT_MS = 1500;

type EngineModule = typeof import('./engine/scrollEngine');
type CanvasModule = typeof import('./canvas/CanvasRoot');
type OverlayModule = typeof import('./overlay/DevOverlay');

export function ExperienceRoot(props: {
  siteCap: Tier | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <TierProvider siteCap={props.siteCap}>
      <ExperienceHost>{props.children}</ExperienceHost>
    </TierProvider>
  );
}

function ExperienceHost(props: { children: React.ReactNode }): React.JSX.Element {
  const tier = useTier();
  const tierStore = useTierStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const [experience] = useState(() => createStore<ExperienceState>({ engine: null }));
  const [runtime] = useState(createFrameRuntime);
  const engine = useStore(experience, (state) => state.engine);

  const loaded = useDocumentLoaded();

  // The engine module (GSAP, ScrollTrigger, Lenis) downloads at `load`, like the canvas: the
  // tier-0 page is complete server HTML, so neither the first paint nor hydration waits for it.
  const [engineModule, setEngineModule] = useState<EngineModule | null>(null);
  useEffect(() => {
    if (!loaded || engineModule !== null) return;
    let cancelled = false;
    import('./engine/scrollEngine').then(
      (mod) => {
        if (!cancelled) setEngineModule(mod);
      },
      (error: unknown) =>
        console.error('[experience] scroll engine failed to load; tier 0.', error),
    );
    return () => {
      cancelled = true;
    };
  }, [loaded, engineModule]);

  // One engine per latched layout; destroy() reverts everything it created (its matchMedia
  // context) on relatch and unmount.
  useEffect(() => {
    const root = rootRef.current;
    if (engineModule === null || !tier.hydrated || root === null) return;
    const created = engineModule.createScrollEngine({ root, layout: tier.layout, scenes: SCENES });
    experience.set({ engine: created });
    tierStore?.setScrollProbe(created);
    // The next engine replaces this one in the same effect pass, so the canvas never sees
    // `engine: null` (which would unmount it and lose the WebGL context).
    return () => {
      tierStore?.setScrollProbe(null);
      created.destroy();
    };
  }, [engineModule, tier.hydrated, tier.layout, experience, tierStore]);
  const introDone = useIntroDone();
  const visible = useDocumentVisible();
  // No canvas while the tier is pending (spec EXP 3.5 rule 7).
  const readyTier: Tier = tier.status === 'ready' ? tier.tier : 0;
  const mountable = canMount({ loaded, introDone, tier: readyTier, visible });

  // The canvas chunk downloads at `load` (behind the intro); context creation waits for the gates.
  const [canvasModule, setCanvasModule] = useState<CanvasModule | null>(null);
  const wantsCanvas = loaded && readyTier >= 1;
  useEffect(() => {
    if (!wantsCanvas || canvasModule !== null) return;
    let cancelled = false;
    import('./canvas/CanvasRoot').then(
      (mod) => {
        if (!cancelled) setCanvasModule(mod);
      },
      (error: unknown) => console.error('[experience] canvas chunk failed to load; tier 0.', error),
    );
    return () => {
      cancelled = true;
    };
  }, [wantsCanvas, canvasModule]);

  const [idleReached, setIdleReached] = useState(false);
  useEffect(() => {
    if (!mountable || idleReached) return;
    return onIdle(() => setIdleReached(true), MOUNT_IDLE_TIMEOUT_MS);
  }, [mountable, idleReached]);

  const [overlayModule, setOverlayModule] = useState<OverlayModule | null>(null);
  useEffect(() => {
    if (!tier.debug || overlayModule !== null) return;
    let cancelled = false;
    import('./overlay/DevOverlay').then(
      (mod) => {
        if (!cancelled) setOverlayModule(mod);
      },
      (error: unknown) => console.error('[experience] developer overlay failed to load.', error),
    );
    return () => {
      cancelled = true;
    };
  }, [tier.debug, overlayModule]);

  const CanvasRoot = canvasModule?.CanvasRoot;
  const DevOverlay = overlayModule?.DevOverlay;
  return (
    <div ref={rootRef} data-experience-root="">
      {props.children}
      {CanvasRoot && idleReached && engine !== null && readyTier >= 1 ? (
        <CanvasRoot
          tier={readyTier as 1 | 2 | 3}
          settings={tier.settings}
          mode={tier.mode}
          engine={engine}
          runtime={runtime}
          stepDown={tier.stepDown}
          stress={tier.stress}
        />
      ) : null}
      {DevOverlay ? <DevOverlay tier={tier} runtime={runtime} experience={experience} /> : null}
    </div>
  );
}
