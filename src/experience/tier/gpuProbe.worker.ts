/**
 * The GPU probe's WebGL 2 context in a dedicated worker (gpuProbe.ts): on a software GPU the
 * context takes 30 to 55 ms to create, one long task after `load` when the main thread does it.
 * Posts `{ renderer }` once it had a context, else null (no WebGL 2 on OffscreenCanvas, as in
 * Safari 16, or none at all), and the main thread probes itself, as before this worker.
 */
import { readRenderer } from './glRenderer';

let facts: { renderer: string | null } | null = null;
try {
  const gl =
    typeof OffscreenCanvas === 'undefined'
      ? null
      : new OffscreenCanvas(1, 1).getContext('webgl2', { powerPreference: 'high-performance' });
  if (gl !== null) {
    facts = { renderer: readRenderer(gl) };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
} catch {
  // The main thread probes again and reports what failed.
}
postMessage(facts);
