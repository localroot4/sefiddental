/** The renderer string of a WebGL 2 context: the unmasked one where the browser exposes it. */
export function readRenderer(gl: WebGL2RenderingContext): string | null {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const value: unknown = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return typeof value === 'string' && value.length > 0 ? value : null;
}
