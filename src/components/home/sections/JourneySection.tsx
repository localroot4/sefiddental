import { Steps } from '@/components/ui/Content';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';

import { WarmLayer } from '../WarmLayer';
import { HomeSection, type Copy } from './HomeSection';

/**
 * Scene 9, first half (family G-static): the first-visit steps and the guide when it is
 * published. The warm layer renders first, as a sibling before the section inside the
 * `first-visit` wrapper (C16: no page.tsx slot); `first-visit.ts` scrubs its `--warm`.
 */
export function JourneySection(props: {
  steps: Array<{ title: string; text: string }>;
  guidePath: string | null;
  copy: Copy;
}) {
  if (props.steps.length === 0) return null;
  return (
    <>
      <WarmLayer />
      <HomeSection section="journey" family="G" copy={props.copy} split>
        <Steps items={props.steps} />
        {props.guidePath ? (
          <TextLink standalone href={props.guidePath} className="mt-6 -ms-2">
            {t('home.journey.guide')}
          </TextLink>
        ) : null}
      </HomeSection>
    </>
  );
}
