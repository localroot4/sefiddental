import { JsonLd } from '@/components/seo/JsonLd';
import { ltr } from '@/components/ui/ltr';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { FactsRow, Steps } from '@/components/ui/Content';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getDoctors, getTestimonials } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { DentistList } from './lists';
import { Alternating, Band, HeroMedia, PageBooking } from './parts';
import { aboutFacts, blocksOf, contentBodies, mediaOf } from './view';

/**
 * T-about (docs/ia.md): the space photo hero (A), the story (K; Latin words such as «VIP» and
 * «CIP» as LTR islands, request R7), verified facts (B), the team (F), how we work (G-static),
 * patient voices (H), booking (J). Every section without content stays hidden.
 */
export async function About({ page }: { page: Page }) {
  const [clinic, doctors, voices] = await Promise.all([
    getClinic(),
    getDoctors(),
    getTestimonials(),
  ]);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: page.title, href: PAGE_PATHS.about },
  ];
  const story = (page.blocks ?? []).filter(
    (block) => block.blockType === 'content' || block.blockType === 'callout',
  );
  const { ids } = headingAnchors(contentBodies(page.blocks));
  const { facts, numbers } = aboutFacts(clinic.stats, page.blocks);
  const steps = blocksOf(page.blocks, 'steps').flatMap((block) => block.items ?? []);
  const shown = voices.filter((v) => mediaOf(v.poster) || v.transcriptSummary || v.quote);
  return (
    <div data-page-type="about">
      <PageHero
        titleSize={heroTitleSize(page.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={page.title}
        summary={page.lead ? ltr(page.lead) : undefined}
        actions={
          <ButtonLink
            size="lg"
            href={PAGE_PATHS.booking}
            track={{ event: 'booking_open', location: 'hero' }}
            data-booking-cta=""
          >
            {t('pages.book')}
          </ButtonLink>
        }
        media={<HeroMedia media={page.heroMedia} caption={t('pages.photo.about')} />}
      />
      <Alternating
        sections={[
          story.length
            ? (tone) => (
                <Band id="story" family="K" tone={tone}>
                  <div className="grid max-w-measure gap-8">
                    {story.map((block, i) =>
                      block.blockType === 'content' ? (
                        <RichBody key={i} data={block.body} ids={ids} />
                      ) : (
                        <Alert
                          key={i}
                          tone={block.tone === 'warning' ? 'warning' : 'info'}
                          title={ltr(block.text)}
                        />
                      ),
                    )}
                  </div>
                </Band>
              )
            : null,
          facts.length
            ? (tone) => (
                <Band id="facts" family="B" title={t('pages.about.facts')} tone={tone}>
                  <FactsRow facts={facts} number={numbers} />
                </Band>
              )
            : null,
          doctors.length
            ? (tone) => (
                <Band
                  id="team"
                  family="F"
                  title={t('pages.about.team')}
                  action={
                    <TextLink standalone href={PAGE_PATHS['dentists-hub']} className="-ms-2">
                      {t('pages.about.allDentists')}
                    </TextLink>
                  }
                  tone={tone}
                >
                  <DentistList doctors={doctors} />
                </Band>
              )
            : null,
          steps.length
            ? (tone) => (
                <Band id="work" family="G" title={t('pages.about.work')} tone={tone}>
                  <Steps items={steps.map((s) => ({ title: ltr(s.title), text: ltr(s.text) }))} />
                </Band>
              )
            : null,
          shown.length
            ? (tone) => (
                <Band id="voices" family="H" title={t('pages.about.voices')} tone={tone}>
                  {/* Posters and written summaries only: testimonials have no captions file yet,
                      and a video plays only with Persian captions (WCAG 1.2.2). */}
                  <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {shown.map((voice) => {
                      const poster = mediaOf(voice.poster);
                      return (
                        <li key={voice.id} className="grid content-start gap-3">
                          <TestimonialCard
                            label={voice.patientLabel}
                            consent={t('pages.voices.consent')}
                            media={
                              poster ? (
                                <Picture
                                  media={poster}
                                  crop="portrait"
                                  sizes="(min-width: 1024px) 26rem, (min-width: 744px) 50vw, 100vw"
                                />
                              ) : null
                            }
                          />
                          {voice.transcriptSummary || voice.quote ? (
                            <p className="text-small text-ink-muted">
                              {voice.transcriptSummary || voice.quote}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Band>
              )
            : null,
        ]}
      />
      <PageBooking clinic={clinic} />
      <JsonLd
        data={jsonLdGraph(breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))))}
      />
    </div>
  );
}
