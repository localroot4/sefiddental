/**
 * A tiny external store for low-frequency experience state (the engine, the canvas mount) and a
 * plain mutable object for per-frame state (gate, frame counter). Per-frame values are never
 * React state: the render loop writes them, the overlay reads them at 4 Hz.
 */
import { useSyncExternalStore } from 'react';

import type { RootState } from '@react-three/fiber';

import type { ScrollEngine } from '../engine/scrollEngine';

import type { Gate } from './gates';

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof T)[];
      if (keys.every((key) => Object.is(state[key], patch[key]))) return;
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** `selector` must return a stored value or a primitive (no new objects per call). */
export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}

export interface ExperienceState {
  engine: ScrollEngine | null;
}

/**
 * Written by the render loop and the canvas host; read by the overlay and the debug hook.
 * Methods instead of field writes: components never mutate a prop object.
 */
export interface FrameRuntime {
  readonly gate: Gate;
  readonly framesRendered: number;
  readonly contextLost: boolean;
  readonly contextLossCount: number;
  /** Counts gate reopenings; the frame monitor restarts its warm-up when it changes. */
  readonly resumes: number;
  /** The R3F root while the canvas is mounted. */
  readonly r3f: (() => RootState) | null;
  setGate(gate: Gate): void;
  countFrame(): void;
  markResume(): void;
  /** Returns the number of losses in this visit. */
  setContextLost(lost: boolean): number;
  setR3f(get: (() => RootState) | null): void;
}

export function createFrameRuntime(): FrameRuntime {
  let gate: Gate = 'not-mounted';
  let framesRendered = 0;
  let contextLost = false;
  let contextLossCount = 0;
  let resumes = 0;
  let r3f: (() => RootState) | null = null;
  return {
    get gate() {
      return gate;
    },
    get framesRendered() {
      return framesRendered;
    },
    get contextLost() {
      return contextLost;
    },
    get contextLossCount() {
      return contextLossCount;
    },
    get resumes() {
      return resumes;
    },
    get r3f() {
      return r3f;
    },
    setGate(next) {
      gate = next;
    },
    countFrame() {
      framesRendered += 1;
    },
    markResume() {
      resumes += 1;
    },
    setContextLost(lost) {
      if (lost && !contextLost) contextLossCount += 1;
      contextLost = lost;
      return contextLossCount;
    },
    setR3f(get) {
      r3f = get;
    },
  };
}
