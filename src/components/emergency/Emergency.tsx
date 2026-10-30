import type { ReactNode } from 'react';

import { BookingDialog } from '@/components/booking/BookingDialog';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { JsonLd } from '@/components/seo/JsonLd';
import { Alert } from '@/components/ui/Alert';
import { ArticleMeta, SourceList } from '@/components/ui/Article';
import { ButtonLink } from '@/components/ui/Button';
import { DirectionsLinks } from '@/components/ui/Contact';
import { Steps } from '@/components/ui/Content';
import { HoursTable } from '@/components/ui/Hours';
import { Icon } from '@/components/ui/Icon';
import { heroTitleSize } from '@/components/ui/Layout';
import { cx } from '@/components/ui/cx';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { ltr } from '@/components/ui/ltr';
import { contentBodies, dentistName, sourceItems } from '@/components/pages/view';
import { t } from '@/i18n/fa';
import { hoursOptionsFrom, toClinicHours } from '@/lib/data/clinicHours';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { hoursState, hoursTableNote } from '@/lib/hoursState';
import type { Flash } from '@/lib/http/flash';
import { PAGE_PATHS } from '@/lib/paths';
import { formatPhoneFa, telHref } from '@/lib/phone';
import { breadcrumbNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { EmergencyForm, NoneLine } from './EmergencyForm';
import { SafetyBox } from './SafetyBox';
import { emergencyView, initialFromFlash } from './view';

const SHEET = 'rounded-sheet border border-line bg-surface-raised p-4 shadow-raised md:p-8';

/**
 * The self-care block (7.4): Payload content of the `emergency` page, written and reviewed in
 * phase 6. Nothing renders until the block and its reviewing dentist exist (gap 42, F9 pattern).
 */
function SelfCare({ page }: { page: Page }) {
  const reviewer = typeof page.reviewer === 'object' ? page.reviewer : null;
  const blocks = page.blocks ?? [];
  if (!reviewer || blocks.length === 0) return null;
  const { ids } = headingAnchors(contentBodies(blocks), ['em-self-care-title']);
  const body: ReactNode[] = blocks.map((block, i) => {
    switch (block.blockType) {
      case 'content':
        return <RichBody key={i} data={block.body} ids={ids} />;
      case 'callout':
        return (
          <Alert
            key={i}
            tone={block.tone === 'warning' ? 'warning' : 'info'}
            title={ltr(block.text)}
          />
        );
      case 'steps':
        return (
          <Steps
            key={i}
            items={(block.items ?? []).map((s) => ({ title: ltr(s.title), text: ltr(s.text) }))}
          />
        );
      default:
        return null;
    }
  });
  return (
    <section aria-labelledby="em-self-care-title" data-section="self-care" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="em-self-care-title" className="text-heading font-semibold">
          {t('emergency.selfCare.heading')}
        </h2>
        <ArticleMeta reviewer={dentistName(reviewer.name)} />
      </div>
      <div className="grid max-w-measure gap-6">{body}</div>
      <SourceList id="em-sources" items={sourceItems(page.sources)} />
    </section>
  );
}

/**
 * T-emergency (docs/ia.md 6, docs/conversion.md 7.1): family L, a focused task with the address
 * and hours as its trust aside (beside it from 1024 px, below it on phones). The server picks
 * the order from the hours state of this request (the page is no-store; QA-CLOCK moves `clock`
 * in e2e): call first while calls are allowed, the safety box first otherwise. Every clinic tel:
 * link sits in [data-call-sheet], so a page left open past closing still meets the closed-hours
 * sheet (EM-H2); the safety box's tel:115 never does.
 */
export async function Emergency(props: {
  page: Page;
  clock: Date;
  tokens: { csrf: string; ts: string } | null;
  flash: Flash | null;
}) {
  const [clinic, features] = await Promise.all([getClinic(), getFeatures()]);
  const hours = toClinicHours(clinic);
  const state = hoursState(props.clock, hours, hoursOptionsFrom(clinic));
  const view = emergencyView(state, clinic.emergency?.priorityPromiseConfirmed === true);
  const landline = clinic.phones.landline;
  const formOn = features.emergencyEnabled !== false;
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: props.page.title, href: PAGE_PATHS.emergency },
  ];

  return (
    <div
      data-page-type="emergency"
      data-family="L"
      className="mx-auto w-full max-w-content px-gutter pt-4 pb-section md:pt-6"
    >
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 grid gap-12 md:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div className="grid min-w-0 content-start gap-8 md:gap-12">
          <header data-section="hero" className="grid justify-items-start gap-4">
            <h1
              className={cx(
                'font-display font-bold',
                heroTitleSize(props.page.title) === 'hero' ? 'text-hero' : 'text-display-1',
              )}
            >
              {props.page.title}
            </h1>
            <p className="max-w-measure text-body-lg text-ink-muted">{t(view.lead)}</p>
            {view.callFirst ? (
              // 7.1 item 3, never gated by triage (EM-C1 to EM-C3); in the first screen at 360x640.
              <div
                data-call-sheet=""
                data-section="call"
                className="mt-2 grid w-full gap-2 md:flex md:w-auto md:items-center md:gap-4"
              >
                <ButtonLink
                  size="lg"
                  href={telHref(landline)}
                  iconStart={<Icon name="phone" size="sm" />}
                  track={{ event: 'call_click', location: 'hero' }}
                  className="w-full md:w-auto"
                >
                  {t('call.label')}
                </ButtonLink>
                <span
                  dir="ltr"
                  className="justify-self-start font-semibold whitespace-nowrap text-ink"
                >
                  {formatPhoneFa(landline)}
                </span>
              </div>
            ) : (
              // Closed (JURY 5): the emergency call is one large thumb target where the open
              // state has the clinic's, above the safety box with its inline 115 link. Never in
              // [data-call-sheet] and never tracked, like that link (EM-D4).
              <ButtonLink
                size="lg"
                variant="danger"
                href="tel:115"
                iconStart={<Icon name="phone" size="sm" />}
                data-section="call-115"
                className="mt-2 w-full md:w-auto"
              >
                {t('emergency.call115')}
              </ButtonLink>
            )}
          </header>

          <SafetyBox id="em-safety" />

          <section data-section="form" aria-labelledby={formOn ? 'em-title' : undefined}>
            {!formOn ? (
              // EM-D8: the information stays; the request goes through a regular booking.
              <p className={cx(SHEET, 'text-body')}>
                <NoneLine />
              </p>
            ) : (
              <EmergencyForm
                clinic={clinic}
                view={view}
                openState={state.state}
                tokens={props.tokens}
                initial={initialFromFlash(props.flash)}
                cardClassName={SHEET}
              />
            )}
          </section>

          <SelfCare page={props.page} />
        </div>

        <aside
          data-section="address"
          aria-labelledby="em-address-title"
          className="grid content-start gap-6 md:max-w-[28rem] lg:sticky lg:top-[calc(var(--nav-h)+var(--space-8))] lg:self-start lg:pt-4"
        >
          <h2 id="em-address-title" className="text-heading font-semibold">
            {t('nav.address')}
          </h2>
          <p className="flex gap-2 text-body">
            <Icon name="map-pin" size="sm" className="mt-[.3em] text-brand" />
            <span>{clinic.address.fullFa}</span>
          </p>
          <DirectionsLinks maps={clinic.maps} location="aside" />
          <HoursTable hours={hours} note={hoursTableNote(hours)} />
        </aside>
      </div>
      <JsonLd
        data={jsonLdGraph(breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))))}
      />
      {/* The header «رزرو نوبت» opens it here (freeze G7, Q11), without its link back to this page. */}
      <BookingDialog emergencyLink={false} />
    </div>
  );
}
