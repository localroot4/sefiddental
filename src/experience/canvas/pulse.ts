/**
 * The canvas's render-on-demand handshake (CI run 111: a canvas that rendered every tick at rest
 * kept phones and tablets busy on software WebGL). Whoever changes what the canvas shows asks for
 * a frame (`request`); the World renders only the frames asked for, or while a slot scene draws
 * (`begin`), and the passes draw only over a frame it rendered (`rendered`). The FrameDriver lets
 * the ticker sleep after a run of frames with nothing to draw; a request wakes it (`onWake`).
 */
export interface Pulse {
  request(): void;
  /** The World's frame: renders when asked for or when `always`; clears the request. */
  begin(always: boolean): boolean;
  /** The World rendered (and cleared) in this frame: the passes may draw over it. */
  rendered(): boolean;
  /** The FrameDriver's wake (one at a time); returns the removal. */
  onWake(wake: () => void): () => void;
}

export function createPulse(): Pulse {
  let wanted = true;
  let drawn = false;
  let wake: (() => void) | null = null;
  return {
    request() {
      wanted = true;
      wake?.();
    },
    begin(always) {
      drawn = wanted || always;
      wanted = false;
      return drawn;
    },
    rendered: () => drawn,
    onWake(next) {
      wake = next;
      return () => {
        if (wake === next) wake = null;
      };
    },
  };
}
