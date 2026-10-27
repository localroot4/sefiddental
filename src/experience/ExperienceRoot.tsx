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
import { track } from '@/lib/track/track';

import { onIdle, useDocumentLoaded, useDocumentVisible, useIntroDone } from './core/browserSignals';
import { canMount } from './core/gates';
import { createFrameRuntime, createStore, useStore, type ExperienceState } from './core/store';
import type { ScrollEngine } from './engine/scrollEngine';
import type { ScenePlace } from './engine/timelineMath';
import { isSceneId, SCENES, SCENES_LOAD_WEBGL } from './scenes/registry';
import type { SceneId } from './scenes/types';
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

  // The engine module (GSAP, ScrollTrigger, Lenis) downloads at `load`, like the canvas, and only
  // once the latched layout is tier 1 or more: at tier 0 it would build no Lenis, no timeline and
  // no pins, yet its evaluation and first measure cost a long task. The tier-0 page is complete
  // server HTML.
  const engineWanted = tier.layout.latchedAtTier >= 1;
  const [engineModule, setEngineModule] = useState<EngineModule | null>(null);
  useEffect(() => {
    if (!loaded || !engineWanted || engineModule !== null) return;
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
  }, [loaded, engineWanted, engineModule]);

  // One engine per latched layout; destroy() reverts everything it created (its matchMedia
  // context) on relatch and unmount. Keep-place across a relatch: the reader's scene and progress
  // are recorded before the old engine goes, restored at once in the document without pins, and
  // again by the new engine after the refresh its pins queue (a pin that went away or arrived
  // moved the content), never on unmount.
  const placeRef = useRef<ScenePlace<SceneId> | null>(null);
  // Settings follow the tier at once; the engine reads them at creation only, so they are not a
  // dependency (a monitor cap must not rebuild the engine).
  const settingsRef = useRef(tier.settings);
  useEffect(() => {
    settingsRef.current = tier.settings;
  }, [tier.settings]);
  useEffect(() => {
    const root = rootRef.current;
    if (engineModule === null || !tier.hydrated || root === null) return;
    const place = placeRef.current;
    placeRef.current = null;
    if (place !== null) {
      const y = engineModule.placeScrollY(root, place);
      if (y !== null) window.scrollTo({ top: y, behavior: 'instant' });
    }
    // Three frames, three short tasks (report, risk table: the engine is created on idle after
    // `load`): this commit's attribute writes are recalculated by the next frame, ScrollTrigger
    // registers on the frame after it, and the engine measures and builds on the third, so no
    // task forces a full style recalculation at 4x. Lenis follows one frame later still.
    let created: ScrollEngine | null = null;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        engineModule.prepareScrollEngine();
        frame = requestAnimationFrame(() => {
          frame = 0;
          created = engineModule.createScrollEngine({
            root,
            layout: tier.layout,
            settings: settingsRef.current,
            scenes: SCENES,
            restore: place ?? undefined,
          });
          experience.set({ engine: created });
          tierStore?.setScrollProbe(created);
        });
      });
    });
    // The next engine replaces this one in the same effect pass, so the canvas never sees
    // `engine: null` (which would unmount it and lose the WebGL context).
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      if (created === null) return;
      placeRef.current = created.activeScene();
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
  // D5: in phase 7 it is requested only under the debug flag or once a registry scene declares
  // `webgl.load` (phase 8); a chunk that draws nothing costs the tier 1 LCP and TBT budgets.
  const [canvasModule, setCanvasModule] = useState<CanvasModule | null>(null);
  const wantsCanvas = loaded && readyTier >= 1 && (tier.debug || SCENES_LOAD_WEBGL);
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
  const canvasMounted = Boolean(CanvasRoot) && idleReached && engine !== null && readyTier >= 1;

  // While no canvas renders, the frame monitor samples the gsap ticker instead (D5): same
  // sampler, same step rule, auto mode only.
  const { stepDown, mode } = tier;
  useEffect(() => {
    if (engineModule === null || engine === null || canvasMounted || mode !== 'auto') return;
    if (readyTier === 0) return;
    return engineModule.monitorFrames(engine, {
      tier: readyTier,
      onStepDown: () => stepDown('monitor'),
    });
  }, [engineModule, engine, canvasMounted, mode, readyTier, stepDown]);

  // `scene_view`: once per scene per page view when the scene's top crosses the viewport middle,
  // at every tier (docs/analytics.md 2). The scene id is the event's location.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-scene') ?? '';
          if (!entry.isIntersecting || seen.has(id)) continue;
          seen.add(id);
          track('scene_view', { location: id });
        }
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    for (const el of root.querySelectorAll('[data-scene]')) {
      if (isSceneId(el.getAttribute('data-scene') ?? '')) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} data-experience-root="">
      {props.children}
      {CanvasRoot && canvasMounted && engine !== null ? (
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
