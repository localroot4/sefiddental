'use client';

/**
 * Home experience root (spec EXP 3.3, freeze 3.14), rendered only by the home page. The server
 * HTML is the tier-0 page; after hydration it latches the layout; after `load` it runs the scroll
 * engine (on a coarse pointer once the engine gate passed, phone spec D23) and mounts the canvas
 * (after the intro and on idle, at tier 1 or more). It renders the light notice first (phone spec
 * section 3). The developer overlay loads only under the debug flag.
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
/** Coarse pointers: the engine waits for the probe's answer at most this long after `load`. */
const ENGINE_GATE_MS = 1500;

type EngineModule = typeof import('./engine/scrollEngine');
type CanvasModule = typeof import('./canvas/CanvasRoot');
type OverlayModule = typeof import('./overlay/DevOverlay');

export function ExperienceRoot(props: {
  siteCap: Tier | null;
  /**
   * The light notice (phone spec 3.2): the root's first child, so the keyboard reaches it right
   * after the header; it reads the tier through the provider.
   */
  notice?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <TierProvider siteCap={props.siteCap}>
      <ExperienceHost notice={props.notice}>{props.children}</ExperienceHost>
    </TierProvider>
  );
}

function ExperienceHost(props: {
  notice?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const tier = useTier();
  const tierStore = useTierStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const [experience] = useState(() => createStore<ExperienceState>({ engine: null }));
  const [runtime] = useState(createFrameRuntime);
  const engine = useStore(experience, (state) => state.engine);

  const loaded = useDocumentLoaded();

  // The engine gate (D23): on a coarse pointer the engine waits for the tier decision, the probe's
  // answer or `load` + 1500 ms (the deadline reads the CPU signal a last time and aborts the
  // benchmark fetch), so a weak phone never downloads or evaluates it. Fine pointers keep the
  // timing the D20 measurements were taken with.
  const coarse = tier.hydrated && !tier.finePointer;
  const answered = tier.status === 'ready';
  const { openGate } = tier;
  const [deadline, setDeadline] = useState(false);
  useEffect(() => {
    if (!loaded || !coarse || answered || deadline) return;
    const id = window.setTimeout(() => {
      openGate();
      setDeadline(true);
    }, ENGINE_GATE_MS);
    return () => window.clearTimeout(id);
  }, [loaded, coarse, answered, deadline, openGate]);

  // The engine module (GSAP, ScrollTrigger, Lenis) downloads at `load`, like the canvas, and only
  // once the latched layout is tier 1 or more: at tier 0 it would build no Lenis, no timeline and
  // no pins, yet its evaluation and first measure cost a long task. The tier-0 page is complete
  // server HTML.
  const engineWanted = tier.layout.latchedAtTier >= 1 && (!coarse || answered || deadline);
  const [engineModule, setEngineModule] = useState<EngineModule | null>(null);
  useEffect(() => {
    if (!loaded || !engineWanted || engineModule !== null) return;
    let cancelled = false;
    // A task of its own: the chunk loader inserts one script per engine chunk (4 to 20 ms for
    // the four in Lighthouse's traces), which made the effects after hydration one long task.
    const id = window.setTimeout(() => {
      import('./engine/scrollEngine').then(
        (mod) => {
          if (!cancelled) setEngineModule(mod);
        },
        (error: unknown) =>
          console.error('[experience] scroll engine failed to load; tier 0.', error),
      );
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [loaded, engineWanted, engineModule]);

  // One engine per latched layout; destroy() reverts everything it created (its matchMedia
  // context) on relatch and unmount. Keep-place across a relatch whose pins changed (D25: only a
  // pin that went away or arrived moves the content, so a phone relatch never scrolls): the
  // reader's scene and progress are recorded before the old engine goes, restored at once in the
  // document without pins, and again by the new engine after the refresh its pins queue, never on
  // unmount.
  const placeRef = useRef<{ place: ScenePlace<SceneId> | null; pinned: boolean } | null>(null);
  // Settings follow the tier at once; the engine reads them at creation only, so they are not a
  // dependency (a monitor cap must not rebuild the engine).
  const settingsRef = useRef(tier.settings);
  useEffect(() => {
    settingsRef.current = tier.settings;
  }, [tier.settings]);
  useEffect(() => {
    const root = rootRef.current;
    if (engineModule === null || !tier.hydrated || root === null) return;
    const kept = placeRef.current;
    placeRef.current = null;
    const place = kept !== null && kept.pinned !== tier.layout.pinnedScenes ? kept.place : null;
    if (place !== null) {
      const y = engineModule.placeScrollY(root, place);
      if (y !== null) window.scrollTo({ top: y, behavior: 'instant' });
    }
    // Three frames, three short tasks (report, risk table: the engine is created on idle after
    // `load`): this commit's attribute writes are recalculated by the next frame, ScrollTrigger
    // registers on the frame after it where the layout makes triggers (every tier from 1), and
    // the engine measures and builds on the third, so no task forces a full style recalculation
    // at 4x. Lenis follows one frame later still.
    let created: ScrollEngine | null = null;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        engineModule.prepareScrollEngine(tier.layout);
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
      placeRef.current = { place: created.activeScene(), pinned: tier.layout.pinnedScenes };
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
  // `webgl.load` (phase 8); a chunk that draws nothing costs the tier 1 LCP and TBT budgets. A
  // phone draws no WebGL in phase 7, so its debug flag loads none either: `?debug=1` then measures
  // the path visitors get (the DOM frame monitor), and the canvas's own monitor, which also samples
  // at rest, cannot step the owner's phone down and write the light floor.
  const [canvasModule, setCanvasModule] = useState<CanvasModule | null>(null);
  const wantsCanvas =
    loaded && readyTier >= 1 && ((tier.debug && !tier.phone) || SCENES_LOAD_WEBGL);
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

  // While no canvas renders, the frame monitor samples the engine's page frames instead (D5):
  // same sampler, same step rule, auto mode only, and only while the page scrolls (D26).
  const { stepDown, mode, phone } = tier;
  useEffect(() => {
    if (engineModule === null || engine === null || canvasMounted || mode !== 'auto') return;
    if (readyTier === 0) return;
    return engineModule.monitorFrames({
      tier: readyTier,
      phone,
      onStepDown: () => stepDown('monitor'),
      onWindow: (sample) => runtime.recordMonitorWindow(sample),
      onFrame: () => runtime.countMonitorFrame(),
    });
  }, [engineModule, engine, canvasMounted, mode, readyTier, stepDown, phone, runtime]);

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
      {props.notice}
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
