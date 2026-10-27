import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LOCKUP_MARK_PATH } from '@/components/brand/LockupParts';
import { IntroOverlay } from '@/components/home/intro/IntroOverlay';
import { INTRO_CSS, INTRO_SCRIPT } from '@/lib/intro/introScript';

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';

describe('IntroOverlay markup (D10; report section 3)', () => {
  const html = renderToStaticMarkup(<IntroOverlay nonce={NONCE} />);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  it('IO1 a closed, labelled dialog#intro with its nonced style and the nonced script after it', () => {
    const dialog = doc.querySelector('dialog#intro');
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.getAttribute('aria-label')).toBeTruthy();
    const style = dialog?.querySelector('style');
    expect(style?.getAttribute('nonce')).toBe(NONCE);
    expect(style?.textContent).toBe(INTRO_CSS);
    const script = doc.querySelector('script');
    expect(script?.getAttribute('nonce')).toBe(NONCE);
    expect(script?.textContent).toBe(INTRO_SCRIPT);
    expect(script?.previousElementSibling).toBe(dialog);
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

  it('IO4 without a nonce the inline elements carry none', () => {
    const bare = new DOMParser().parseFromString(
      renderToStaticMarkup(<IntroOverlay nonce={undefined} />),
      'text/html',
    );
    expect(bare.querySelector('style')?.hasAttribute('nonce')).toBe(false);
    expect(bare.querySelector('script')?.hasAttribute('nonce')).toBe(false);
  });
});
