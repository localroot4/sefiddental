import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PHONE_MOTION } from './phone';
import { reveal, revealHeading } from './reveal';
import { killAll, registerScrollTrigger } from './sceneTest';

beforeAll(registerScrollTrigger);
afterEach(killAll);

function section(count: number): { el: HTMLElement; items: HTMLElement[] } {
  const el = document.createElement('section');
  const items = Array.from({ length: count }, () => el.appendChild(document.createElement('p')));
  document.body.append(el);
  return { el, items };
}

describe('reveal', () => {
  it('RV1 from 1024 px hides the targets at once and rises 16 px once; under it each target scrubs its own Rise (phone.ts)', () => {
    const { el, items } = section(2);
    reveal(items, el, true);
    expect(items.map((p) => p.style.opacity)).toEqual(['0', '0']);
    expect(gsap.getTweensOf(items[0]!)[0]?.vars.y).toBe(16);
    expect(ScrollTrigger.getAll().map((t) => [t.trigger, t.vars.once])).toEqual([[el, true]]);
    const narrow = section(2);
    reveal(narrow.items, narrow.el, false);
    for (const item of narrow.items) {
      const trigger = ScrollTrigger.getAll().find((t) => t.trigger === item);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect(gsap.getProperty(item, 'y')).toBe(PHONE_MOTION.rise.y);
    }
  });

  it('RV2 a focus inside shows the targets at once; the cleanup drops that listener', () => {
    const { el, items } = section(1);
    const cleanup = reveal(items, el, true);
    el.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(items[0]!.style.opacity).toBe('1');

    const other = section(1);
    reveal(other.items, other.el, true)();
    other.el.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(other.items[0]!.style.opacity).toBe('0');
    cleanup();
  });

  it('RV3 no targets, no tween and no trigger', () => {
    const { el } = section(0);
    reveal([], el, true)();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('RV4 an entrance already behind the reader is left in its server state: no tween, no trigger', () => {
    const { el, items } = section(1);
    el.getBoundingClientRect = () => ({ top: 100 }) as DOMRect; // innerHeight 768: past 80 %
    reveal(items, el, true)();
    expect(items[0]!.getAttribute('style')).toBeNull();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('RV5 the photos of the targets open with a curtain on the same trigger, only when asked; a focus ends it', () => {
    const { el, items } = section(2);
    const img = items[0]!.appendChild(document.createElement('img'));
    const cleanup = reveal(items, el, true, 'y', true);
    const opening = gsap.getTweensOf(img)[0];
    expect(opening?.vars).toMatchObject({ clipPath: 'inset(100% 0% 0% 0%)', scale: 1.06 });
    expect(opening?.scrollTrigger?.trigger).toBe(el);
    el.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(opening?.progress()).toBe(1);
    cleanup();
    const plain = section(1);
    const other = plain.items[0]!.appendChild(document.createElement('img'));
    reveal(plain.items, plain.el, true);
    expect(gsap.getTweensOf(other)).toHaveLength(0);
  });

  it('RV6 a heading rises half its font size out of its own bottom edge (the clip moves with it), once at 85 %; none under 1024 px or behind the reader', () => {
    const host = document.createElement('section');
    const heading = host.appendChild(document.createElement('h2'));
    heading.style.fontSize = '40px';
    document.body.append(host);
    const cleanup = revealHeading(heading, true);
    expect(gsap.getProperty(heading, 'y')).toBe(20);
    expect(heading.style.opacity).toBe('0');
    expect(heading.style.clipPath).toBe('inset(0px 0px 20px 0px)');
    const [trigger] = ScrollTrigger.getAll();
    expect([trigger?.trigger, trigger?.vars.start, trigger?.vars.once]).toEqual([
      heading,
      'top 85%',
      true,
    ]);
    // A focus in its section shows it at once, unclipped.
    host.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(heading.style.opacity).toBe('1');
    expect(heading.style.clipPath).toBe('');
    cleanup();
    const narrow = document.createElement('h2');
    document.body.append(narrow);
    revealHeading(narrow, false)();
    const seen = document.createElement('h2');
    seen.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    document.body.append(seen);
    revealHeading(seen, true)();
    revealHeading(null, true)();
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    expect(narrow.getAttribute('style')).toBeNull();
    expect(seen.getAttribute('style')).toBeNull();
  });
});
