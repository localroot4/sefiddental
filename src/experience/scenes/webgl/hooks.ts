/** Hooks the slot scenes share: the molar geometry and the theme. */
import { useEffect, useState } from 'react';

import type { BufferGeometry } from 'three';

import { loadMolar } from './molar';
import { isDark, token, watchTheme } from './pass';

/** The shared molar geometry once it has loaded; null before and after a failed load. */
export function useMolar(): BufferGeometry | null {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let current = true;
    loadMolar().then(
      (loaded) => {
        if (current) setGeometry(loaded);
      },
      // A load the unmount cut short (a navigation away) is not an error.
      (error: unknown) => {
        if (current)
          console.error('[experience] molar.glb failed to load; the DOM art stays.', error);
      },
    );
    return () => {
      current = false;
    };
  }, []);
  return geometry;
}

/**
 * Applies the theme to `rig` now and on every change, and disposes the rig when it goes (a new
 * rig, the unmount).
 */
export function useRigLifetime(
  rig: { setTheme(dark: boolean, brand: string): void; dispose(): unknown } | null,
): void {
  useEffect(() => {
    if (rig === null) return;
    const apply = (): void => rig.setTheme(isDark(), token('--color-brand'));
    apply();
    const off = watchTheme(apply);
    return () => {
      off();
      rig.dispose();
    };
  }, [rig]);
}
