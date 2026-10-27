import type { Page } from '@/payload-types';

type WorkflowBlock = Extract<NonNullable<Page['blocks']>[number], { blockType: 'workflow' }>;

/** One step of the home page's `workflow` block (title, line, 4:3 photo), as Payload generates it. */
export type WorkflowItem = NonNullable<WorkflowBlock['items']>[number];

/**
 * Scene 5 (family G), the digital workflow (phase 7 step 0 stub; the WORKFLOW lane fills it): four
 * steps on the diagonal from the page's `workflow` block, `data-scene="workflow"`
 * `data-home-section="workflow"`. It renders nothing until the block is published (D2: the e2e
 * fixture publishes it on the e2e database only). The prop shape is fixed in step 0.
 */
export function WorkflowSection(_props: { items: WorkflowItem[] }): null {
  return null;
}
