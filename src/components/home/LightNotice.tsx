'use client';

/**
 * The light notice (phone spec section 3, D27): a non-modal status under the header that tells a
 * coarse-pointer visitor the device got the light version, with one switch that saves a «کیفیت»
 * choice through the store. `lightNotice()` decides whether it may open; this component picks the
 * moment (the 'loaded' copy at the first scroll idle once the hero card is behind the header, so
 * never over the first screen; the 'stepped' copy once the layout relatched, so the words match the
 * screen) and keeps it open until «بستن» or the end of the page view. No timer closes it.
 *
 * Accessibility (3.5): the status paragraph is in the DOM, empty, from hydration; the closed box is
 * `sr-only`, never `display: none`, and has no buttons. Opening shows the box one frame before its
 * text, so screen readers announce it. Focus never moves on open or on a switch (one button whose
 * label follows the state); «بستن» moves a focus it held to `main`, as the skip link does. While a
 * text field has focus the box is transparent and inert (the text stays, so nothing is announced
 * again). Labels and the house Button classes come as props (as the form islands get theirs):
 * the string table and ui/Button stay out of the client bundle.
 */
import { useEffect, useRef, useState } from 'react';

import { isTextField } from '@/components/chrome/stickyBar';
import { cx } from '@/components/ui/cx';
import { useIntroDone } from '@/experience/core/browserSignals';
import { keyValue } from '@/experience/tier/browserEnv';
import { RELATCH_IDLE_MS } from '@/experience/tier/latch';
import {
  dismissUntil,
  LIGHT_NOTICE_KEY,
  lightNotice,
  parseDismiss,
  type LightVariant,
} from '@/experience/tier/lightNotice';
import { useTier } from '@/experience/tier/TierProvider';
import { parseFloor, RELATCH_POLL_MS } from '@/experience/tier/tierStore';
import { LIGHT_FLOOR_KEY, type Tier } from '@/lib/qualityTier';

export interface LightNoticeLabels {
  loaded: string;
  stepped: string;
  on: string;
  off: string;
  turnOn: string;
  turnOff: string;
  dismiss: string;
}

type Phase = 'closed' | 'entering' | 'open' | 'leaving';

/** `--dur-2`, the exit; the box goes back to `sr-only` after it. */
const EXIT_MS = 200;
const TEXT_ID = 'light-notice-text';
const LABEL = 'whitespace-normal text-balance';

const local = keyValue(() => window.localStorage);
const session = keyValue(() => window.sessionStorage);

// Under the header (z-30) and above the content; the sticky bar owns the bottom. Under 744 px the
// two buttons share the row's width; from 744 px they sit at the inline end; in a landscape phone
// (at most 500 px high) the text and the buttons share one row, 40rem wide so the text keeps to
// two lines. The insets are the layout viewport's, which a page wider than the screen widens (the
// header at a 200 % root font: 446 px on a 390 px phone), so the width is also capped by 100vw,
// the screen. In dark the shadow does not show and the line border is about 1.1:1 against the
// trust band, so the strong line draws the edge (the box read as a hole, not a raised sheet).
const BOX =
  'fixed inset-x-gutter top-[calc(var(--header-h)+var(--space-2))] z-[25] mx-auto grid max-w-[min(28rem,100vw-2*var(--gutter))] gap-2 rounded-sheet border border-line bg-surface-raised p-3 text-small text-ink shadow-floating transition-[opacity,translate] duration-(--dur-2) ease-out dark:border-line-strong [@media(max-height:500px)]:flex [@media(max-height:500px)]:max-w-[min(40rem,100vw-2*var(--gutter))] [@media(max-height:500px)]:items-center';

/**
 * Calls `open` at the first scroll idle (1000 ms without a `scrollY` change, polled as the latch
 * waits) once the bottom of the hero card is above the bottom of the header: the H1 is the promise
 * and the LCP text, so the first screen is never covered.
 */
function afterHeroIdle(open: () => void): () => void {
  let lastY = window.scrollY;
  let stillMs = 0;
  const id = window.setInterval(() => {
    const y = window.scrollY;
    stillMs = y === lastY ? stillMs + RELATCH_POLL_MS : 0;
    lastY = y;
    if (stillMs < RELATCH_IDLE_MS) return;
    const card =
      document.getElementById('bk-hero')?.parentElement ??
      document.querySelector('[data-scene="hero"]');
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    if (card && card.getBoundingClientRect().bottom > headerBottom) return;
    window.clearInterval(id);
    open();
  }, RELATCH_POLL_MS);
  return () => window.clearInterval(id);
}

export function LightNotice({
  labels,
  buttonClass,
}: {
  labels: LightNoticeLabels;
  /** `buttonClasses('secondary')` and `buttonClasses('ghost')` from ui/Button, on the server. */
  buttonClass: { toggle: string; dismiss: string };
}): React.JSX.Element {
  const tier = useTier();
  const introDone = useIntroDone();
  const box = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<LightVariant | null>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const [text, setText] = useState('');
  const [textField, setTextField] = useState(false);

  const { hydrated, status, mode, reason, finePointer, lastStep } = tier;
  const effective = tier.tier;
  // From the store, not local state: a «کیفیت» change elsewhere while the notice is open keeps the
  // switch's label true.
  const effects = mode === 'fixed' && effective > 0;
  const latchedAtTier = tier.layout.latchedAtTier;
  useEffect(() => {
    if (variant !== null) return; // once per page view
    const want = lightNotice({
      state: { hydrated, status, tier: effective, mode, reason, finePointer, lastStep },
      introDone,
      shown: session.get(LIGHT_NOTICE_KEY) !== null,
      dismissed: parseDismiss(local.get(LIGHT_NOTICE_KEY)),
      now: Date.now(),
    });
    if (want === null) return;
    const open = (): void => {
      session.set(LIGHT_NOTICE_KEY, '1');
      setVariant(want.variant);
      setPhase('entering');
    };
    if (want.variant === 'loaded') return afterHeroIdle(open);
    if (latchedAtTier !== 0) return;
    const id = requestAnimationFrame(open);
    return () => cancelAnimationFrame(id);
  }, [
    variant,
    hydrated,
    status,
    effective,
    mode,
    reason,
    finePointer,
    lastStep,
    introDone,
    latchedAtTier,
  ]);

  // Frame 1 shows the box and its buttons, frame 2 puts the text in (and fades the box in).
  useEffect(() => {
    if (phase !== 'entering' || variant === null) return;
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        setPhase('open');
        setText(labels[variant]);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [phase, variant, labels]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const id = window.setTimeout(() => {
      setPhase('closed');
      setText('');
    }, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const shown = phase !== 'closed';
  useEffect(() => {
    if (!shown) return;
    // After focus moved on, not mid-change (as the sticky bar).
    const settle = (): void => {
      window.setTimeout(() => setTextField(isTextField(document.activeElement)));
    };
    settle();
    document.addEventListener('focusin', settle);
    document.addEventListener('focusout', settle);
    return () => {
      document.removeEventListener('focusin', settle);
      document.removeEventListener('focusout', settle);
    };
  }, [shown]);

  // While shown, scrolled-to fields and links land below the box (WCAG 2.4.11; globals.css).
  useEffect(() => {
    const el = box.current;
    if (!shown || el === null) return;
    const html = document.documentElement;
    const observer = new ResizeObserver(() => {
      html.style.setProperty('--light-notice-h', `calc(${el.offsetHeight}px + var(--space-2))`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      html.style.removeProperty('--light-notice-h');
    };
  }, [shown]);

  const onSwitch = (): void => {
    const on = !effects;
    tier.setUserOverride(on ? (Math.max(1, tier.decision?.detectedTier ?? 1) as Tier) : 0);
    setText(on ? labels.on : labels.off);
  };

  const onDismiss = (): void => {
    const now = Date.now();
    const floorUntil = parseFloor(local.get(LIGHT_FLOOR_KEY))?.until ?? null;
    local.set(
      LIGHT_NOTICE_KEY,
      JSON.stringify({ variant, until: dismissUntil(reason, now, floorUntil) }),
    );
    const main = document.getElementById('main');
    if (main !== null && box.current?.contains(document.activeElement)) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
    setPhase('leaving');
  };

  return (
    <div
      ref={box}
      data-light-notice={phase}
      inert={shown && (textField || phase === 'leaving')}
      className={
        shown
          ? cx(
              BOX,
              phase !== 'open' && '-translate-y-2',
              (phase !== 'open' || textField) && 'opacity-0',
            )
          : 'sr-only'
      }
    >
      {/* The text's lines kept from frame 1, so its arrival moves no button (CLS 0): two on a
          phone and in landscape, one on a tall screen from 744 px, where the copy fits a line. In
          landscape a one-line text sits in the middle of its two lines, level with the buttons. */}
      <p
        id={TEXT_ID}
        role="status"
        className="min-h-[2lh] md:[@media(min-height:501px)]:min-h-[1lh] [@media(max-height:500px)]:flex [@media(max-height:500px)]:flex-1 [@media(max-height:500px)]:items-center"
      >
        {text}
      </p>
      {shown ? (
        <div className="flex flex-wrap gap-2 md:justify-end">
          {/* The labels wrap in their own span: the house button is `whitespace-nowrap`, so at a
              200 % root font the switch was wider than the box, and a `whitespace-normal` on the
              button itself loses to it (the same property, emitted later in the CSS). */}
          <button
            type="button"
            aria-describedby={TEXT_ID}
            onClick={onSwitch}
            className={cx(buttonClass.toggle, 'flex-1 md:flex-none')}
          >
            <span className={LABEL}>{effects ? labels.turnOff : labels.turnOn}</span>
          </button>
          <button
            type="button"
            aria-describedby={TEXT_ID}
            onClick={onDismiss}
            className={cx(buttonClass.dismiss, 'flex-1 md:flex-none')}
          >
            <span className={LABEL}>{labels.dismiss}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
