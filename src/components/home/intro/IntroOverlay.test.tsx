import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LOCKUP_MARK_PATH } from '@/components/brand/LockupParts';
import { IntroOverlay, IntroScript } from '@/components/home/intro/IntroOverlay';
import { INTRO_CSS, INTRO_SCRIPT } from '@/lib/intro/introScript';

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';

describe('IntroOverlay markup (D10; report section 3)', () => {
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
  const doc = parse(renderToStaticMarkup(<IntroOverlay nonce={NONCE} />));
  // In the body, as inside the hero: alone, the link and the script would parse into <head>.
  const scriptDoc = parse(`<body>${renderToStaticMarkup(<IntroScript nonce={NONCE} />)}`);

  it("IO1 a closed, labelled dialog#intro with its nonced style; the nonced script is apart (after the hero's first row)", () => {
    const dialog = doc.querySelector('dialog#intro');
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.getAttribute('aria-label')).toBeTruthy();
    const style = dialog?.querySelector('style');
    expect(style?.getAttribute('nonce')).toBe(NONCE);
    expect(style?.textContent).toBe(INTRO_CSS);
    expect(doc.querySelector('script')).toBeNull();
    const script = scriptDoc.querySelector('script');
    expect(script?.getAttribute('nonce')).toBe(NONCE);
    expect(script?.textContent).toBe(INTRO_SCRIPT);
  });

  it('IO2 no style attribute anywhere (CSP), one focusable element: the skip button', () => {
    expect(doc.querySelectorAll('[style]')).toHaveLength(0);
    const focusable = doc.querySelectorAll('a, button, input, [tabindex]');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]?.tagName).toBe('BUTTON');
    expect(focusable[0]?.getAttribute('type')).toBe('button');
    expect(focusable[0]?.textContent).toBe('رد کردن انیمیشن');
  });

  it('IO3 every lockup part is its own <svg><use> of the sprite; the frame is a square minus the mark', () => {
    const uses = [...doc.querySelectorAll('dialog svg use')].map((u) => u.getAttribute('href'));
    expect(uses).toEqual([
      '#lockup-mark',
      '#lockup-stroke-left',
      '#lockup-stroke-right',
      '#lockup-wordmark',
      '#lockup-bar',
      '#lockup-diamond-1',
      '#lockup-diamond-2',
      '#lockup-diamond-3',
      '#lockup-diamond-4',
    ]);
    for (const use of doc.querySelectorAll('dialog svg use')) {
      expect(use.parentElement?.tagName).toBe('svg');
      expect(use.parentElement?.querySelectorAll('*')).toHaveLength(1);
    }
    const frame = doc.querySelector('svg.i-f path');
    expect(frame?.getAttribute('fill-rule')).toBe('evenodd');
    expect(frame?.getAttribute('d')).toMatch(/^M-?\d+(\.\d+)? -?\d+(\.\d+)?h10000v10000h-10000z/);
    expect(frame?.getAttribute('d')?.endsWith(LOCKUP_MARK_PATH)).toBe(true);
  });

  it('IO5 rendering waits for the script: the render-blocking expect link names it', () => {
    const link = scriptDoc.querySelector('link[rel="expect"]');
    expect(link?.getAttribute('blocking')).toBe('render');
    // A missing id would block rendering until the whole document is parsed.
    const target = scriptDoc.querySelector(link?.getAttribute('href') ?? '#none');
    expect(target).not.toBeNull();
    expect(target).toBe(scriptDoc.querySelector('script#intro-script'));
  });

  it('IO4 without a nonce the inline elements carry none', () => {
    const bare = parse(renderToStaticMarkup(<IntroOverlay nonce={undefined} />));
    expect(bare.querySelector('style')?.hasAttribute('nonce')).toBe(false);
    const bareScript = parse(renderToStaticMarkup(<IntroScript nonce={undefined} />));
    expect(bareScript.querySelector('script')?.hasAttribute('nonce')).toBe(false);
  });
});
