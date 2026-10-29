/**
 * Scene 6, before and after (phase 7 report, plan section 2). The DOM slider works at every tier
 * from user input alone (D12: its clip-path never follows scroll, so this module never touches
 * it); at tiers 1 to 3 the figure's slot and the side text rise once as the section enters from
 * 1024 px, and each scrubs its own Rise under it (phone spec scene 6, `reveal`'s phone branch; a
 * focus on the slider puts its slot at rest). Motivation: the reader proves the result with their
 * own hand, so the scene only presents the slider and never moves it for them.
 */
import type { DomScene } from '../types';

import { reveal } from './reveal';

const scene: DomScene = {
  setup: (ctx) => reveal(ctx.el.querySelectorAll('[data-enter]'), ctx.el, ctx.conditions.wide),
};
export default scene;
