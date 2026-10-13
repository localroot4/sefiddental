import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { THEME_STORAGE_KEY } from '@/lib/theme/themeInitScript';

function mockSystemDark(dark: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })),
  );
  return listeners;
}

describe('ThemeToggle (spec 5.5)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('TT1 follows the system preference until the visitor chooses', () => {
    mockSystemDark(true);
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'تغییر پوسته' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('TT2 click flips the theme, stores it, flips aria-pressed and sends theme_toggle', async () => {
    mockSystemDark(false);
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'تغییر پوسته' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    act(() => button.click());
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    const body = JSON.parse(await (sendBeacon.mock.calls[0]?.[1] as Blob).text()) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ event: 'theme_toggle', location: 'header' });
    act(() => button.click());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('TT3 re-applies a stored choice the attribute lost (dev Strict Mode)', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('TT4 a 44 px target with both icons hidden from assistive technology', () => {
    mockSystemDark(false);
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('size-target');
    expect(button?.getAttribute('type')).toBe('button');
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });
});
