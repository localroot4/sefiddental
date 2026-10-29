/**
 * Radio groups that CSS follows without `:has()` (Tiers, RestorationSection): on a `[data-choices]`
 * element, `data-choice` is the position of its checked radio (1-based; absent while none is) and
 * the checked radio's `[data-choice-item]` gets `data-checked`. A `:has()` rule anywhere in the
 * site CSS makes every DOM insertion restyle the whole page (phase 7 Lighthouse tier 1). Synced
 * at setup (a choice made before hydration, a restored form) and on every `change`; a script that
 * checks a radio dispatches `change` too.
 */
export function setupChoices(doc: Document): () => void {
  const sync = (group: Element) => {
    const radios = Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const at = radios.findIndex((radio) => radio.checked);
    if (at < 0) group.removeAttribute('data-choice');
    else group.setAttribute('data-choice', String(at + 1));
    for (const radio of radios) {
      radio.closest('[data-choice-item]')?.toggleAttribute('data-checked', radio.checked);
    }
  };
  const onChange = (event: Event) => {
    const group = event.target instanceof Element ? event.target.closest('[data-choices]') : null;
    if (group) sync(group);
  };
  doc.querySelectorAll('[data-choices]').forEach(sync);
  doc.addEventListener('change', onChange);
  return () => doc.removeEventListener('change', onChange);
}
