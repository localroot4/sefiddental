import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { barPx, phoneMotion, PHONE_MOTION } from './phone';
import { reveal } from './reveal';

/** What the stubbed media queries answer (jsdom has no matchMedia); `md` is globals.css's rem query. */
const media = { fine: false, md: false };

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches:
        (query === '(pointer: fine)' && media.fine) ||
        (query === '(min-width: 46.5rem)' && media.md),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  // A tall document: a clamped range is clamped to the maximum scroll, 0 in an empty jsdom page.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 10_000,
    configurable: true,
  });
  gsap.registerPlugin(ScrollTrigger);
});

/** Element tops by element; the rest sit one viewport below (jsdom lays nothing out). */
let tops: Map<Element, number>;
let reads: string[];

beforeEach(() => {
  media.fine = false;
  media.md = false;
  tops = new Map();
  reads = [];
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    reads.push('rect');
    const top = tops.get(this) ?? 2000;
    return { top, bottom: top + 500, height: 500, left: 0, right: 0, width: 0 } as DOMRect;
  });
  // The sticky bar: 64 px (its safe area included), as on a 390 px phone.
  document.body.innerHTML = '<nav data-sticky-bar=""></nav>';
  Object.defineProperty(document.querySelector('[data-sticky-bar]'), 'offsetHeight', {
    value: 64,
  });
});

afterEach(() => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function column(count: number, style = ''): HTMLElement[] {
  const section = document.body.appendChild(document.createElement('section'));
  return Array.from({ length: count }, () => {
    const p = section.appendChild(document.createElement('p'));
    if (style) p.setAttribute('style', style);
    return p;
  });
}

const triggerOf = (el: Element): ScrollTrigger | undefined =>
  ScrollTrigger.getAll().find((t) => t.trigger === el);

describe('phone scroll set (phone spec 2.1, U-PH10)', () => {
  it('PH1 reveal under 1024 px: one scrubbed trigger per item from the bar top, eased none, clamped, no once', () => {
    const items = column(2);
    const section = items[0]!.parentElement!;
    reveal(items, section, false);
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    for (const item of items) {
      const trigger = triggerOf(item);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect(trigger?.vars.once).toBeUndefined();
      expect(trigger?.vars.invalidateOnRefresh).toBeUndefined();
      expect((trigger?.vars.start as () => string)()).toBe('clamp(top bottom-=64)');
      const tween = gsap.getTweensOf(item)[0];
      expect(tween?.vars.ease).toBe('none');
      expect(gsap.getProperty(item, 'y')).toBe(PHONE_MOTION.rise.y);
      expect(item.style.opacity).toBe('0');
      expect(item.hasAttribute('data-scrub')).toBe(true);
    }
    expect(barPx()).toBe(64);
  });

  it('PH2 the guard sits at the bar top: a target whose range started gets no entrance', () => {
    const [above, at] = column(2);
    tops.set(above!, 768 - 64 - 1); // its top is above the bar top (jsdom: 768 px viewport)
    tops.set(at!, 768 - 64);
    phoneMotion({ rise: [above!, at!] });
    expect(above!.getAttribute('style')).toBeNull();
    expect(above!.hasAttribute('data-scrub')).toBe(false);
    expect(triggerOf(above!)).toBeUndefined();
    expect(triggerOf(at!)).toBeDefined();
  });

  it('PH3 every guard rect is read before the first gsap write', () => {
    const fromTo = gsap.fromTo.bind(gsap);
    vi.spyOn(gsap, 'fromTo').mockImplementation(((...args: Parameters<typeof gsap.fromTo>) => {
      reads.push('write');
      return fromTo(...args);
    }) as typeof gsap.fromTo);
    const [a, b] = column(2);
    const [row] = column(1);
    const [mark] = column(1);
    phoneMotion({ rise: [a!, b!], slide: [row!], settle: [mark!] });
    expect(reads.slice(0, 4)).toEqual(['rect', 'rect', 'rect', 'rect']);
    expect(reads.indexOf('write')).toBe(4);
    expect(reads.filter((r) => r === 'write')).toHaveLength(4);
  });

  it('PH4 Slide moves the row container from the inline start (+16 in RTL, -16 in LTR, the gutter), never its cards', () => {
    const [rtl] = column(1, 'direction: rtl');
    const card = rtl!.appendChild(document.createElement('article'));
    const [ltr] = column(1, 'direction: ltr');
    reveal([rtl!], rtl!, false, 'x');
    reveal([ltr!], ltr!, false, 'x');
    expect(gsap.getProperty(rtl!, 'x')).toBe(PHONE_MOTION.slide.x);
    expect(gsap.getProperty(ltr!, 'x')).toBe(-PHONE_MOTION.slide.x);
    expect(triggerOf(rtl!)?.vars.end).toBe('clamp(top 75%)');
    expect(card.getAttribute('style')).toBeNull();
    expect(ScrollTrigger.getAll().some((t) => t.trigger === card)).toBe(false);
  });

  it('PH5 Settle scales from 0.94 and dims to 0.6 until 60 %', () => {
    const [mark] = column(1);
    phoneMotion({ settle: [mark!] });
    expect(gsap.getProperty(mark!, 'scale')).toBe(PHONE_MOTION.settle.scale);
    expect(mark!.style.opacity).toBe('0.6');
    expect(triggerOf(mark!)?.vars.end).toBe('clamp(top 60%)');
  });

  it('PH6 a focus inside a target ends its scrub at the rest state; the cleanup drops the listener', () => {
    const [item, other] = column(2);
    const field = item!.appendChild(document.createElement('input'));
    const cleanup = phoneMotion({ rise: [item!] });
    // A scroll left the lag tween on its way to half the range.
    const lag = triggerOf(item!)?.getTween();
    lag?.resetTo('totalProgress', 0.5, 0);
    field.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(triggerOf(item!)).toBeUndefined();
    lag?.progress(1); // the lag tween's next frames, had it survived
    expect(item!.style.opacity).toBe('1');
    expect(gsap.getProperty(item!, 'y')).toBe(0);
    cleanup();

    phoneMotion({ rise: [other!] })();
    other!.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(triggerOf(other!)).toBeDefined();
    expect(other!.style.opacity).toBe('0');
  });

  it('PH7 a fine pointer (Lenis smooths it) scrubs without lag', () => {
    media.fine = true;
    const [item] = column(1);
    phoneMotion({ rise: [item!] });
    expect(triggerOf(item!)?.vars.scrub).toBe(true);
  });
});

describe('Drift and Fill (U-PH11)', () => {
  function photo(): { frame: HTMLElement; img: HTMLElement } {
    const frame = document.body.appendChild(document.createElement('div'));
    const img = frame.appendChild(document.createElement('img'));
    tops.set(frame, 400);
    return { frame, img };
  }

  it('PH8 Drift moves the img by 4 % of the frame each way under 744 px, the only function value', () => {
    const { frame, img } = photo();
    phoneMotion({ drift: { img, frame } });
    const trigger = triggerOf(frame);
    expect(trigger?.vars).toMatchObject({
      start: 'clamp(top bottom)',
      end: 'clamp(bottom top)',
      invalidateOnRefresh: true,
    });
    expect(gsap.getProperty(img, 'y')).toBe(-PHONE_MOTION.drift.share * 500);
    expect(gsap.getTweensOf(img)[0]?.vars.force3D).toBe(true);
    expect(img.hasAttribute('data-scrub')).toBe(true);
    expect(frame.getAttribute('style')).toBeNull();
  });

  it('PH9 Drift is 0 from the md breakpoint, in rem as the server CSS (744 px at a 16 px default font)', () => {
    media.md = true;
    const { frame, img } = photo();
    phoneMotion({ drift: { img, frame } });
    expect(gsap.getProperty(img, 'y')).toBe(0);
  });

  it('PH10 Fill scales the line from its top over the list; the revert leaves no inline style', () => {
    const list = document.body.appendChild(document.createElement('ol'));
    const line = list.appendChild(document.createElement('span'));
    const ctx = gsap.context(() => {
      phoneMotion({ fill: [{ line, list }] });
    });
    expect(gsap.getProperty(line, 'scaleY')).toBe(0);
    expect(triggerOf(list)?.vars).toMatchObject({
      start: 'clamp(top 60%)',
      end: 'clamp(bottom 60%)',
    });
    expect(triggerOf(list)?.vars.invalidateOnRefresh).toBeUndefined();
    ctx.revert();
    // Tier 0 never runs the engine, and a relatch to it reverts every inline style.
    expect(line.style.cssText).toBe('');
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
