/** Hooks the slot scenes share: the molar geometry, the room environment and the theme. */
import { useEffect, useState } from 'react';

import type { BufferGeometry, Texture, WebGLRenderer } from 'three';

import { loadMolar } from './molar';
import { isDark, token, watchTheme } from './pass';
import { createRoomEnvironment } from './studio';

/** The shared molar geometry once it has loaded; null before and after a failed load. */
export function useMolar(): BufferGeometry | null {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let current = true;
    loadMolar().then(
      (loaded) => {
        if (current) setGeometry(loaded);
      },
      (error: unknown) =>
        console.error('[experience] molar.glb failed to load; the DOM art stays.', error),
    );
    return () => {
      current = false;
    };
  }, []);
  return geometry;
}

/** The room environment on `target` while it is set, built again after a lost context returns. */
export function useRoomEnvironment(
  gl: WebGLRenderer,
  target: { setEnvironment(texture: Texture | null): void } | null,
): void {
  useEffect(() => {
    if (target === null) return;
    let env: ReturnType<typeof createRoomEnvironment> | null = null;
    const build = (): void => {
      env?.dispose();
      env = createRoomEnvironment(gl);
      target.setEnvironment(env.texture);
    };
    build();
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextrestored', build);
    return () => {
      canvas.removeEventListener('webglcontextrestored', build);
      target.setEnvironment(null);
      env?.dispose();
    };
  }, [gl, target]);
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
