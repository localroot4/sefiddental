import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeButton } from '@/components/chrome/ThemeButton';
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
    render(<ThemeButton location="header" />);
    const button = screen.getByRole('button', { name: 'تغییر پوسته' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('TT2 click flips the theme, stores it, flips aria-pressed and sends theme_toggle', async () => {
    mockSystemDark(false);
    render(<ThemeButton location="drawer" />);
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
    expect(body).toMatchObject({ event: 'theme_toggle', location: 'drawer' });
    act(() => button.click());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('TT3 re-applies a stored choice the attribute lost (dev Strict Mode)', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeButton location="header" />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('TT4 a 44 px target with both icons hidden from assistive technology', () => {
    mockSystemDark(false);
    const { container } = render(<ThemeButton location="header" />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('size-target');
    expect(button?.getAttribute('type')).toBe('button');
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('TT5 the island takes its label and icons from the parent (no strings or icon code inside)', () => {
    mockSystemDark(false);
    render(
      <ThemeToggle label="label" location="header">
        <span data-testid="icon" />
      </ThemeToggle>,
    );
    expect(screen.getByRole('button', { name: 'label' })).toBeTruthy();
    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});
