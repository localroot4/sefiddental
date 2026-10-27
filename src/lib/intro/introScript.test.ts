// @vitest-environment jsdom
import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INTRO_CSS, INTRO_SCRIPT, INTRO_SCRIPT_SHA256 } from '@/lib/intro/introScript';

type Mql = MediaQueryList & { fire: () => void };

/** What the script touches, stubbed where jsdom has no implementation. */
function stage(
  opts: {
    path?: string;
    reduce?: boolean;
    saveData?: boolean;
    quality?: string | null;
    session?: string | null;
    storageThrows?: boolean;
    image?: boolean;
    showModalThrows?: boolean;
  } = {},
) {
  document.body.innerHTML = `<dialog id="intro"></dialog><section data-scene="hero">${opts.image === false ? '' : '<img alt="">'}</section>`;
  delete document.documentElement.dataset.intro;
  window.history.replaceState({}, '', opts.path ?? '/');
  sessionStorage.clear();
  localStorage.clear();
  if (opts.session) sessionStorage.setItem('sefid-intro', opts.session);
  if (opts.quality) localStorage.setItem('sefid-quality', opts.quality);
  if (opts.storageThrows) {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
  }
  const listeners = new Set<() => void>();
  const mql = {
    matches: opts.reduce ?? false,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
    fire: () => listeners.forEach((f) => f()),
  } as unknown as Mql;
  window.matchMedia = () => mql;
  Object.defineProperty(navigator, 'connection', {
    value: opts.saveData ? { saveData: true } : undefined,
    configurable: true,
  });
  const dialog = document.getElementById('intro') as HTMLDialogElement;
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    if (opts.showModalThrows) throw new Error('already open');
    this.open = true;
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
  const marks: string[] = [];
  performance.mark = ((name: string) => {
    marks.push(name);
  }) as typeof performance.mark;
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
  HTMLImageElement.prototype.decode = () => Promise.resolve();
  const ended = vi.fn();
  document.addEventListener('sefid:intro-end', ended);
  return { dialog, showModal, close, marks, mql, ended, listeners };
}

const run = () => new Function(INTRO_SCRIPT)();
const state = () => document.documentElement.dataset.intro;
const progress = () =>
  Number(document.getElementById('intro')!.style.getPropertyValue('--intro-p'));
const detail = (ended: ReturnType<typeof vi.fn>) =>
  (ended.mock.calls[0]?.[0] as CustomEvent<{ skipped: boolean; reduced: boolean }>).detail;

describe('intro script: bytes and hash (report section 3)', () => {
  it('IS1 the exported hash is the SHA-256 of the exact script bytes', () => {
    expect(createHash('sha256').update(INTRO_SCRIPT, 'utf8').digest('base64')).toBe(
      INTRO_SCRIPT_SHA256,
    );
  });

  it('IS2 the script is under 2048 bytes and the stylesheet at most 3.5 KB', () => {
    expect(Buffer.byteLength(INTRO_SCRIPT, 'utf8')).toBeLessThan(2048);
    expect(Buffer.byteLength(INTRO_CSS, 'utf8')).toBeLessThanOrEqual(3500);
  });

  it('IS3 pinned: an edit to the script or its hash forces a CSP review', () => {
    expect(INTRO_SCRIPT_SHA256).toBe('do90HQcwGkvhGCO/Sa+7hcoh8tAHPU3jlcOWxIGWnSA=');
    for (const needle of [
      '"sefid-intro"',
      '"sefid-quality"',
      '"sefid:intro-end"',
      '"sefid:intro-progress"',
      '"intro:start"',
      '"intro:end"',
      '1400',
    ]) {
      expect(INTRO_SCRIPT).toContain(needle);
    }
    expect(INTRO_CSS).not.toContain('clip-path');
    // The bar's property lives on the dialog: written on <html> it would restyle the document.
    expect(INTRO_SCRIPT).toContain('D.style.setProperty("--intro-p"');
    expect(INTRO_SCRIPT).not.toContain('h.style');
    // The closed dialog is hidden by this sheet, not only by the user-agent one.
    expect(INTRO_CSS).toContain('#intro:not([open]){display:none}');
    // Every part `i-fade` hides keeps an underlying opacity of 1 (the fade has no `from`): the
    // word enters through its own delayed animation, never from a base `opacity:0`.
    const word = /\.i-w\{[^}]*\}/.exec(INTRO_CSS)?.[0];
    expect(word).toContain('animation:i-in .4s var(--ease-in-out) .5s both');
    expect(word).not.toContain('opacity:0');
    expect(INTRO_CSS).toContain('@keyframes i-fade{to{opacity:0}}');
  });
});

describe('intro script: branches (D14, lane INTRO)', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['another route', { path: '/x' }],
    ['reduced motion', { reduce: true }],
    ['Save-Data', { saveData: true }],
    ['a saved quality of 0', { quality: '0' }],
    ['a repeat visit in the session', { session: '1' }],
  ])('IS4 exits without an overlay on %s', (_label, opts) => {
    const s = stage(opts);
    run();
    expect(state()).toBeUndefined();
    expect(s.showModal).not.toHaveBeenCalled();
    expect(s.marks).toEqual([]);
    vi.advanceTimersByTime(1500);
    expect(state()).toBeUndefined();
    expect(s.ended).not.toHaveBeenCalled();
  });

  it('IS5 plays: modal before first paint, stages at 500 and 900 ms, the end at 1300 ms', () => {
    const s = stage();
    run();
    expect(state()).toBe('playing');
    expect(s.showModal).toHaveBeenCalledOnce();
    expect(s.dialog.open).toBe(true);
    expect(s.marks).toEqual(['intro:start']);
    vi.advanceTimersByTime(499);
    expect(s.dialog.className).toBe('');
    vi.advanceTimersByTime(1);
    expect(s.dialog.className).toBe('s2');
    vi.advanceTimersByTime(400);
    expect(s.dialog.className).toBe('s2 s3');
    vi.advanceTimersByTime(399);
    expect(state()).toBe('playing');
    // Wheel events on the dialog are cancelled while it is up (no scroll container to stop them).
    const wheel = new Event('wheel', { cancelable: true });
    s.dialog.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state()).toBe('done');
    expect(s.dialog.open).toBe(false);
    // The sequential focus start is the body again, with no tabindex left behind.
    expect(document.activeElement).toBe(document.body);
    expect(document.body.hasAttribute('tabindex')).toBe(false);
    expect(sessionStorage.getItem('sefid-intro')).toBe('1');
    expect(s.marks).toEqual(['intro:start', 'intro:end']);
    expect(s.ended).toHaveBeenCalledOnce();
    expect(detail(s.ended)).toEqual({ skipped: false, reduced: false });
    // Listeners are gone: a key, a wheel, the cap timer and a media switch end nothing twice.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    const later = new Event('wheel', { cancelable: true });
    s.dialog.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    s.mql.fire();
    vi.advanceTimersByTime(200);
    expect(s.ended).toHaveBeenCalledOnce();
    expect(s.listeners.size).toBe(0);
  });

  it.each([
    ['any key', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))],
    [
      'a click on the dialog',
      (s: ReturnType<typeof stage>) => s.dialog.dispatchEvent(new Event('click')),
    ],
    [
      'a native close (Esc through cancel)',
      (s: ReturnType<typeof stage>) => s.dialog.dispatchEvent(new Event('close')),
    ],
    [
      'a reduced-motion switch',
      (s: ReturnType<typeof stage>) => {
        (s.mql as { matches: boolean }).matches = true;
        s.mql.fire();
      },
    ],
  ])('IS6 ends early on %s and never reopens', (label, act) => {
    const s = stage();
    run();
    vi.advanceTimersByTime(200);
    act(s);
    expect(state()).toBe('done');
    expect(s.dialog.open).toBe(false);
    expect(detail(s.ended)).toEqual({
      skipped: true,
      reduced: label === 'a reduced-motion switch',
    });
    vi.advanceTimersByTime(1500);
    expect(s.dialog.open).toBe(false);
    expect(s.ended).toHaveBeenCalledOnce();
  });

  it('IS7 the bar is the mean of the loading shares, never full before 400 ms', async () => {
    const s = stage();
    run();
    expect(progress()).toBe(0);
    // Fonts count after two frames (the first layout starts the font requests) and fonts.ready.
    await vi.advanceTimersByTimeAsync(40);
    expect(progress()).toBe(0.25);
    await vi.advanceTimersByTimeAsync(359);
    expect(progress()).toBe(0.25);
    await vi.advanceTimersByTimeAsync(1);
    expect(progress()).toBe(0.5);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    await Promise.resolve();
    expect(progress()).toBe(0.75);
    window.dispatchEvent(new Event('load'));
    expect(progress()).toBe(1);
    // Phase 8 feeds a fifth share; its value is clamped to 0..1.
    document.dispatchEvent(new CustomEvent('sefid:intro-progress', { detail: { p: 0.5 } }));
    expect(progress()).toBe(0.9);
    document.dispatchEvent(new CustomEvent('sefid:intro-progress', { detail: { p: 7 } }));
    expect(progress()).toBe(1);
    document.dispatchEvent(new CustomEvent('sefid:intro-progress', { detail: { p: -1 } }));
    expect(progress()).toBe(0.8);
    expect(s.dialog.open).toBe(true);
    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('IS8 without a hero image the image share counts at DOMContentLoaded', () => {
    stage({ image: false });
    run();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(progress()).toBe(0.25);
  });

  it('IS9 an error after the cap timer ends the intro instead of trapping the page', () => {
    const s = stage({ showModalThrows: true });
    run();
    expect(state()).toBe('done');
    expect(s.dialog.open).toBe(false);
    expect(detail(s.ended)).toEqual({ skipped: true, reduced: false });
  });

  it('IS10 blocked storage neither stops the intro nor its end', () => {
    const s = stage({ storageThrows: true });
    run();
    expect(state()).toBe('playing');
    vi.advanceTimersByTime(1300);
    expect(state()).toBe('done');
    expect(s.ended).toHaveBeenCalledOnce();
  });
});
