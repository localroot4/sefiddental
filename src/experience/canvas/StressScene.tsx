'use client';

/**
 * GPU load for the drop-path tests (`?debug=1&stress=N`, spec EXP 3.2): a full-screen quad whose
 * fragment shader loops N x 64 times per pixel. Debug only; never mounted without the flag.
 */
import { useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';

// Measured on SwiftShader at 1440 x 900: stress=4 renders about one frame per second, and the
// monitor walks tier 3 to 0 in about 10 s once the cover is scrolled away.
const LOOPS_PER_STEP = 64;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform int uLoops;
  varying vec2 vUv;
  void main() {
    vec3 c = vec3(vUv, 0.5);
    for (int i = 0; i < 1024; i++) {
      if (i >= uLoops) break;
      c = fract(sin(c * 12.9898 + float(i) * 0.001 + uTime) * 43758.5453);
    }
    gl_FragColor = vec4(vec3(0.5) + c * 0.05, 1.0);
  }
`;

export function StressScene(props: { loops: number }): React.JSX.Element {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uLoops: { value: props.loops * LOOPS_PER_STEP } }),
    [props.loops],
  );

  useFrame((state) => {
    const current = material.current;
    if (current?.uniforms.uTime) current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
