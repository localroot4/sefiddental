import { ButtonLink } from '@/components/ui/Button';
import { FaqList } from '@/components/ui/Content';
import { TextLink } from '@/components/ui/TextLink';
import { EMERGENCY_PATH, t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';

import { HomeSection, type Copy } from './HomeSection';

/**
 * Scene 9, second half (family I): the FAQ with a sticky aside from 1024 px (call, WhatsApp,
 * booking); under 1024 the sticky bar does that job. The emergency answer links the emergency
 * page (conversion.md 3: home reaches it through the FAQ).
 */
export function FaqSection(props: {
  faqs: Array<{ question: string; answer: string }>;
  copy: Copy;
  phone: string;
  whatsapp: string | null;
}) {
  if (props.faqs.length === 0) return null;
  const urgent = props.faqs.findIndex((f) => f.question.includes('درد شدید'));
  const items = props.faqs.map((faq, i) => ({
    question: faq.question,
    answer:
      i === urgent ? (
        <>
          {faq.answer}{' '}
          <TextLink href={EMERGENCY_PATH} className="whitespace-nowrap">
            {t('urgent.label')}
          </TextLink>
        </>
      ) : (
        faq.answer
      ),
  }));
  return (
    <HomeSection section="faq" family="I" copy={props.copy} tone="sunken">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="grid gap-4">
          <FaqList items={items} />
          {urgent < 0 ? (
            <TextLink href={EMERGENCY_PATH} standalone className="-ms-2 justify-self-start">
              {t('urgent.label')}
            </TextLink>
          ) : null}
        </div>
        <aside
          aria-labelledby="home-faq-aside"
          className="hidden content-start gap-3 self-start rounded-card border border-line bg-surface-raised p-6 lg:sticky lg:top-[calc(var(--nav-h)+var(--space-4))] lg:grid"
        >
          <h3 id="home-faq-aside" className="text-body-lg leading-[1.4] font-semibold">
            {t('home.faq.aside')}
          </h3>
          <ButtonLink
            fullWidth
            href={PAGE_PATHS.booking}
            track={{ event: 'booking_open', location: 'aside' }}
            data-booking-cta=""
          >
            {t('home.book')}
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            fullWidth
            href={telHref(props.phone)}
            track={{ event: 'call_click', location: 'aside' }}
            data-call-sheet=""
          >
            {t('call.label')}
          </ButtonLink>
          {props.whatsapp ? (
            <ButtonLink
              variant="ghost"
              fullWidth
              href={props.whatsapp}
              track={{ event: 'whatsapp_click', location: 'aside' }}
            >
              {t('booking.whatsapp')}
            </ButtonLink>
          ) : null}
        </aside>
      </div>
    </HomeSection>
  );
}
