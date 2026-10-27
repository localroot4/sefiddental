'use client';

/**
 * Developer overlay (spec EXP 3.11): fps, tier, GPU, DPR, memory, gate and engine rows, updated
 * at 4 Hz, never per frame. Loaded with `import()` only under the debug flag; it also installs
 * `window.__sefid` for Playwright. An LTR island in English at the bottom start corner.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TierOverride } from '@/lib/qualityTier';

import { applyStyle } from '../core/applyStyle';
import {
  buildSnapshot,
  createFpsMeter,
  createSceneFps,
  installDebugHook,
  type DebugSnapshot,
} from '../core/debugHook';
import { parseExperienceQuery } from '../core/query';
import type { ExperienceState, FrameRuntime, Store } from '../core/store';
import type { TierState } from '../tier/tierStore';

const UPDATE_MS = 250;
const RENDERER_CHARS = 48;
const CHOICES: readonly TierOverride[] = [0, 1, 2, 3, 'auto'];

// The wrapper inherits the page direction, so inline-start is the RTL start (right) corner.
const WRAP_STYLE = {
  position: 'fixed',
  'inset-block-end': 'var(--space-2)',
  'inset-inline-start': 'var(--space-2)',
  'z-index': '50',
  'max-inline-size': 'min(calc(100vw - 2 * var(--space-2)), 32rem)',
  'max-block-size': 'calc(100dvh - 2 * var(--space-2))',
  overflow: 'auto',
} as const;
const BOX_STYLE = {
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--color-surface-raised)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-line-strong)',
  'border-radius': 'var(--radius-input)',
  'box-shadow': 'var(--shadow-floating)',
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;
const PRE_STYLE = {
  margin: '0',
  'white-space': 'pre-wrap',
  'overflow-wrap': 'anywhere',
  font: 'inherit',
} as const;
const ROW_STYLE = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: 'var(--space-1)',
  'margin-block-start': 'var(--space-2)',
} as const;
const BUTTON_STYLE = {
  'min-block-size': 'var(--target)',
  'min-inline-size': 'var(--target)',
  padding: '0 var(--space-2)',
  border: '1px solid var(--color-line-strong)',
  'border-radius': 'var(--radius-input)',
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  font: 'inherit',
  cursor: 'pointer',
} as const;
const PRESSED_STYLE = {
  ...BUTTON_STYLE,
  background: 'var(--color-brand)',
  color: 'var(--color-on-brand)',
} as const;

const styleWrap = (el: HTMLDivElement | null): void => applyStyle(el, WRAP_STYLE);
const styleBox = (el: HTMLDivElement | null): void => applyStyle(el, BOX_STYLE);
const styleButton = (el: HTMLButtonElement | null): void => applyStyle(el, BUTTON_STYLE);
const stylePre = (el: HTMLPreElement | null): void => applyStyle(el, PRE_STYLE);
const styleRow = (el: HTMLDivElement | null): void => applyStyle(el, ROW_STYLE);

const fmt = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? 'n/a' : value.toFixed(digits);

function rows(s: DebugSnapshot): string {
  const renderer = s.gpu?.renderer ?? null;
  const shortRenderer =
    renderer === null
      ? ''
      : renderer.length > RENDERER_CHARS
        ? `${renderer.slice(0, RENDERER_CHARS)}...`
        : renderer;
  return [
    `fps     ${fmt(s.fps)}  p50 ${fmt(s.frameMsP50)} ms  p95 ${fmt(s.frameMsP95)} ms`,
    `tier    ${s.tier} (${s.reason})  detected ${s.detectedTier ?? 'n/a'}  ${s.mode}  cap ${s.monitorCap ?? '-'}  ${s.status}`,
    `layout  pins ${s.layout.pinnedScenes ? 'on' : 'off'}  lenis ${s.layout.lenis ? 'on' : 'off'}  latched ${s.layout.latchedAtTier}`,
    `gpu     ${s.gpu ? `${s.gpu.type} t${s.gpu.tier} ${fmt(s.gpu.fps, 0)} fps ${shortRenderer}` : `webgl2 ${s.webgl2 ?? 'n/a'}`}`,
    `dpr     device ${fmt(s.dpr.device, 2)}  cap ${fmt(s.dpr.cap, 2)}  scale ${fmt(s.dpr.renderScale, 2)}  gl ${fmt(s.dpr.pixelRatio, 2)}  perf ${fmt(s.dpr.performance, 2)}`,
    `memory  heap ${fmt(s.memory.heapUsedMB)}/${fmt(s.memory.heapLimitMB, 0)} MB  geo ${s.memory.geometries ?? 'n/a'}  tex ${s.memory.textures ?? 'n/a'}  prog ${s.memory.programs ?? 'n/a'}  calls ${s.memory.calls ?? 'n/a'}  tris ${s.memory.triangles ?? 'n/a'}`,
    `gate    ${s.gate}  frames ${s.framesRendered}`,
    `engine  lenis ${s.lenis ? 'on' : 'off'}  triggers ${s.scrollTriggers}  progress ${s.progress.toFixed(4)}  velocity ${fmt(s.velocity, 0)}`,
    `scene   ${s.scene ?? 'none'} ${s.sceneProgress.toFixed(4)}  fps ${fmt(s.sceneFps?.mean)} (min ${fmt(s.sceneFps?.min)})`,
    `init    ${fmt(s.engineInitMs)} ms  ticks ${s.tickSubscribers}  draggables ${s.draggables}`,
  ].join('\n');
}

function TierButton(props: {
  choice: TierOverride;
  pressed: boolean;
  onPick: (c: TierOverride) => void;
}) {
  const { pressed, choice, onPick } = props;
  const styleChoice = useCallback(
    (el: HTMLButtonElement | null) => applyStyle(el, pressed ? PRESSED_STYLE : BUTTON_STYLE),
    [pressed],
  );
  return (
    <button type="button" ref={styleChoice} aria-pressed={pressed} onClick={() => onPick(choice)}>
      {String(choice)}
    </button>
  );
}

export function DevOverlay(props: {
  tier: TierState;
  runtime: FrameRuntime;
  experience: Store<ExperienceState>;
}): React.JSX.Element {
  const { runtime, experience } = props;
  const tierRef = useRef(props.tier);
  const snapshotRef = useRef<(() => DebugSnapshot) | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState<TierOverride>(
    () => parseExperienceQuery(window.location.search).tier ?? 'auto',
  );

  useEffect(() => {
    tierRef.current = props.tier;
  }, [props.tier]);

  useEffect(() => {
    const fps = createFpsMeter();
    const sceneFps = createSceneFps();
    const snapshot = () =>
      buildSnapshot({ tier: tierRef.current, runtime, experience, fps, sceneFps });
    snapshotRef.current = snapshot;
    const uninstall = installDebugHook(snapshot, (o) => tierRef.current.setUserOverride(o));
    const timer = window.setInterval(() => setText(rows(snapshot())), UPDATE_MS);
    return () => {
      window.clearInterval(timer);
      uninstall();
      fps.stop();
      snapshotRef.current = null;
    };
  }, [runtime, experience]);

  const { setPageOverride } = props.tier;
  const onPick = useCallback(
    (choice: TierOverride) => {
      setPicked(choice);
      setPageOverride(choice);
    },
    [setPageOverride],
  );

  const onCopy = () => {
    const snapshot = snapshotRef.current;
    if (snapshot === null) return;
    navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2)).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      (error: unknown) =>
        console.warn('[experience] copy failed (clipboard needs HTTPS or focus).', error),
    );
  };

  return (
    <div data-dev-overlay="" ref={styleWrap}>
      <div dir="ltr" lang="en" ref={styleBox}>
        <pre ref={stylePre}>{text}</pre>
        <div role="group" aria-label="Tier for this page load" ref={styleRow}>
          {CHOICES.map((choice) => (
            <TierButton
              key={String(choice)}
              choice={choice}
              pressed={picked === choice}
              onPick={onPick}
            />
          ))}
          <button type="button" ref={styleButton} onClick={onCopy}>
            {copied ? 'copied' : 'copy JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}
