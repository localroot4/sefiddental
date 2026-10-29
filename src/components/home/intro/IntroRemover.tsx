'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

const INTRO_END = 'sefid:intro-end';
/** The script's 1400 ms cap from its own start, plus 200 ms of grace for a late timer. */
const BACKSTOP_MS = 1600;

const isPlaying = (): boolean => document.documentElement.dataset.intro === 'playing';
const serverPlaying = (): boolean => true;

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-intro'] });
  document.addEventListener(INTRO_END, onChange);
  return () => {
    observer.disconnect();
    document.removeEventListener(INTRO_END, onChange);
  };
}

/**
 * Keeps the intro dialog (and its inline assets) in the tree while `html[data-intro]` is
 * `playing` and removes it afterwards, after hydration only (report C4): the server and the
 * hydration pass render it from the server snapshot, and the first client snapshot drops it
 * when the inline script exited early (attribute absent) or already ended (`done`). Never
 * `useIntroDone()`: its cap counts from navigation start, while the script's does from its own
 * execution, so on a slow document that hook would remove the open dialog mid-animation.
 * One backstop from the same origin as the script: `intro:start` plus 1600 ms; if the attribute
 * is still `playing` then, a synthetic `close` event on the dialog runs the script's own end
 * (one `sefid:intro-end`, its listeners removed) while that listener is still armed, and only
 * a script that no longer answers is ended here, because the CSS failsafe only hides the
 * dialog while `showModal()` keeps the page inert.
 */
export function IntroRemover(props: { children: ReactNode }): ReactNode {
  const playing = useSyncExternalStore(subscribe, isPlaying, serverPlaying);
  useEffect(() => {
    const start = performance.getEntriesByName('intro:start')[0]?.startTime;
    if (start === undefined) return;
    const timer = window.setTimeout(
      () => {
        if (!isPlaying()) return;
        const dialog = document.querySelector<HTMLDialogElement>('dialog#intro');
        dialog?.dispatchEvent(new Event('close'));
        if (!isPlaying()) return;
        dialog?.close();
        document.documentElement.dataset.intro = 'done';
        document.dispatchEvent(
          new CustomEvent(INTRO_END, { detail: { skipped: true, reduced: false } }),
        );
      },
      Math.max(0, start + BACKSTOP_MS - performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, []);
  // An inert element keeps the dialog's place among the scenes: Chrome restores a reload's scroll
  // from an anchor selector with :nth-child indices, read from the page without the dialog and
  // resolved in the server markup with it, which put a reload at voices on dentists.
  return playing ? props.children : <template />;
}
