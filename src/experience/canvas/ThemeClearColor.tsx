'use client';

/**
 * The canvas is opaque (`alpha: false`), so its clear color is the theme's surface token and
 * follows `html[data-theme]` and the system preference (both themes are first-class in WebGL).
 */
import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';
import { Color } from 'three';

export function ThemeClearColor(): null {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const color = new Color();
    const apply = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface')
        .trim();
      if (value !== '') gl.setClearColor(color.setStyle(value));
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', apply);
    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', apply);
    };
  }, [gl]);

  return null;
}
