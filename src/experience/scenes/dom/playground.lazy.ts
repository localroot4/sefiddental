/**
 * The playground's plugin chunk (phase 7 report, plan section 5): Draggable and InertiaPlugin,
 * requested by `scenes/dom/footer.ts` through `ctx.nearViewport` when the stage is within one
 * viewport and the playground runs (tier 1 or more), registered once. Never in the engine chunk
 * or the initial JS; at most 16 KiB of transfer (T-BF3). A default export, so the scene chunk
 * carries no `Draggable` property name that the plugin-needle checks (T-EX5) would read as the
 * plugin itself.
 */
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';

gsap.registerPlugin(Draggable, InertiaPlugin);
// `registerPlugin` files a class under its `.name`, which the production build mangles (`tq` in
// the built chunk), so the debug hook's count (`gsap.core.globals().Draggable`, debugHook.ts)
// would never find it: file it under its real name as well.
(gsap as unknown as { core: { globals(name: string, value: unknown): void } }).core.globals(
  'Draggable',
  Draggable,
);

export default Draggable;
