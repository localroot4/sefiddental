import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import type { Page } from '@/payload-types';

import { HomeSection, media, PIN_STAGE, PinRoom, type Copy } from './HomeSection';

type WorkflowBlock = Extract<NonNullable<Page['blocks']>[number], { blockType: 'workflow' }>;

/** One step of the home page's `workflow` block (title, line, 4:3 photo), as Payload generates it. */
export type WorkflowItem = NonNullable<WorkflowBlock['items']>[number];

/**
 * Diagonal placement of step n inside the stage (lanes WORKFLOW): its centre at
 * `calc(50% + (n - 1) * 30%)` from the start edge and `calc(50% + (n - 1) * 40%)` from the top,
 * so the path's pan of 0.9 x 1.2 stage sizes puts step n at the stage centre at progress
 * (n - 1) / 3. Static classes per position (no `style` attribute, CSP; Tailwind cannot build a
 * class from an index); the insets act only while the stage is diagonal (position absolute: a
 * step is never `relative`, or the insets would offset the vertical list).
 */
export const PLACE = [
  'start-[50%] top-[50%]',
  'start-[80%] top-[90%]',
  'start-[110%] top-[130%]',
  'start-[140%] top-[170%]',
];

// The stage: from 1024 px `html[data-pins]` (the latch, before the first paint) turns the list into
// the diagonal stage, sticky under the nav through two viewport heights (`PinRoom`); `data-reveal`
// (set by the scene's observer at tier 1 from 1024 px) hides a step until it enters, under a class
// the script adds (`.in`), never in the tier-0 HTML; the transition exists only on a revealed step,
// so the hidden state applies at once (no fade-out when the engine starts). The vertical list is a
// timeline at every tier (D24: the same boxes at tiers 0 to 3 under 1024 px): each step stands one
// diamond column (the diamond and the title's gap) in from the inline start, where the line runs
// from the first diamond down the list (a sibling of the list: an `<ol>` holds only `<li>`); the
// diamond steps back into that column, over the line. Phones scrub the line's fill (`workflow.ts`);
// it is full at tier 0 and from 1024 px. The diagonal has neither the column nor the line.
const STAGE = `group/wf relative ${PIN_STAGE} lg:[[data-pins]_&]:h-[calc(100svh-var(--nav-h))] lg:[[data-pins]_&]:overflow-clip`;
const PATH = 'grid gap-12 md:gap-16 lg:[[data-pins]_&]:absolute lg:[[data-pins]_&]:inset-0';
const LINE =
  'absolute start-[calc(var(--space-2)-1px)] top-[calc(var(--text-heading)*var(--leading-heading)/2)] bottom-0 w-[2px] bg-brand lg:[[data-pins]_&]:hidden';
const STEP =
  'grid gap-4 ps-[calc(var(--space-4)+var(--space-3))] md:grid-cols-2 md:items-center md:gap-8 lg:[[data-pins]_&]:ps-0 ' +
  'lg:[[data-pins]_&]:absolute lg:[[data-pins]_&]:w-[min(28rem,40vw)] lg:[[data-pins]_&]:translate-x-1/2 lg:[[data-pins]_&]:-translate-y-1/2 lg:[[data-pins]_&]:grid-cols-1 lg:[[data-pins]_&]:gap-4 ' +
  'group-data-reveal/wf:[&.in]:transition-[translate,opacity] group-data-reveal/wf:[&.in]:duration-(--dur-3) group-data-reveal/wf:[&.in]:ease-out group-data-reveal/wf:not-[.in]:translate-y-3 group-data-reveal/wf:not-[.in]:opacity-0 md:group-data-reveal/wf:not-[.in]:translate-y-4';

/**
 * Scene 5 (family G), the digital workflow (phase 7 D2): four steps from the page's `workflow`
 * block, each with one of the lockup's diamonds as its marker, a title, a line and a lazy 4:3
 * photo. Tier 0, tier 1 and phones read them as a vertical list; at tiers 2 and 3 from 1024 px
 * the stage sticks and the scene module pans the list along a diagonal (`scenes/dom/workflow.ts`).
 * It renders nothing until the block is published (the e2e fixture publishes it on the e2e
 * database only). The warm overlay of each photo is the scene's light shift, one opacity per step.
 * `sizes` names the wider of the two layouts at each width: from 1280 px the vertical list's
 * photo column (37rem in the 80rem container) is wider than the diagonal's step (28rem).
 */
export function WorkflowSection(props: { items: WorkflowItem[]; copy?: Copy }) {
  const items = props.items.slice(0, PLACE.length);
  if (items.length === 0) return null;
  return (
    <HomeSection scene="workflow" section="workflow" family="G" copy={props.copy ?? null}>
      <div className={STAGE} data-workflow-stage="">
        <div
          className="pointer-events-none absolute inset-0"
          data-world-slot="workflow"
          aria-hidden="true"
        />
        <span className={LINE} data-workflow-line="" aria-hidden="true" />
        <ol className={PATH} data-workflow-path="">
          {items.map((item, i) => {
            const photo = media(item.photo);
            return (
              <li key={item.id ?? i} className={`${STEP} ${PLACE[i]}`} data-workflow-step="">
                <div className="grid content-start gap-3">
                  <h3 className="flex items-center gap-3 text-heading font-semibold">
                    <svg
                      className="relative -ms-[calc(var(--space-4)+var(--space-3))] size-4 shrink-0 fill-brand lg:[[data-pins]_&]:ms-0"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <use href={`#lockup-diamond-${i + 1}`} />
                    </svg>
                    {item.title}
                  </h3>
                  <p className="max-w-measure text-body text-ink-muted">{item.text}</p>
                </div>
                <MediaFrame ratio="4:3">
                  {photo ? (
                    <Picture
                      media={photo}
                      sizes="(min-width: 1280px) 37rem, (min-width: 1024px) 28rem, (min-width: 744px) 50vw, 100vw"
                    />
                  ) : (
                    <MediaPlaceholder caption={item.title} />
                  )}
                  <span
                    className="absolute inset-0 bg-warm opacity-0"
                    data-workflow-warm=""
                    aria-hidden="true"
                  />
                </MediaFrame>
              </li>
            );
          })}
        </ol>
      </div>
      <PinRoom vh={2} />
    </HomeSection>
  );
}
