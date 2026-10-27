/**
 * The DOM scene modules by id (phase 7 report, plan section 3): static imports, so they ship in
 * the engine chunk and never in the initial JS. The intro is an overlay, not a scroll scene.
 */
import type { DomScene, SceneId } from '../types';

import booking from './booking';
import compare from './compare';
import dentists from './dentists';
import firstVisit from './first-visit';
import footer from './footer';
import hero from './hero';
import restoration from './restoration';
import services from './services';
import trust from './trust';
import voices from './voices';
import workflow from './workflow';

export const DOM_SCENES: Readonly<Record<Exclude<SceneId, 'intro'>, DomScene>> = Object.freeze({
  hero,
  trust,
  services,
  restoration,
  workflow,
  compare,
  dentists,
  voices,
  'first-visit': firstVisit,
  booking,
  footer,
});
