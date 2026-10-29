// Home (docs/ia.md T-home, freeze F4): the ten sections in reading order, hero B, and the static
// version of every scene (tier 0). The server HTML is the complete page; ExperienceRoot adds the
// scroll engine and the canvas after hydration, and phases 7 and 8 animate this markup through
// its [data-scene] hooks.
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { LockupSprite } from '@/components/brand/LockupParts';
import {
  DemoCasesSection,
  DemoDentistsSection,
  DemoVoicesSection,
} from '@/components/demo/DemoSections';
import { HomeBookingPrefill } from '@/components/home/HomeBookingPrefill';
import { HomeHero } from '@/components/home/HomeHero';
import { LightNotice } from '@/components/home/LightNotice';
import { IntroOverlay, IntroScript } from '@/components/home/intro/IntroOverlay';
import { BookingSection } from '@/components/home/sections/BookingSection';
import { CasesSection } from '@/components/home/sections/CasesSection';
import { DentistsSection } from '@/components/home/sections/DentistsSection';
import { FaqSection } from '@/components/home/sections/FaqSection';
import { JourneySection } from '@/components/home/sections/JourneySection';
import { PlaygroundSection } from '@/components/home/sections/PlaygroundSection';
import { RestorationSection } from '@/components/home/sections/RestorationSection';
import { ServicesSection } from '@/components/home/sections/ServicesSection';
import { VoicesSection } from '@/components/home/sections/VoicesSection';
import { WorkflowSection } from '@/components/home/sections/WorkflowSection';
import { getHomeData, getHomePage } from '@/components/home/homeData';
import { heroImage, heroSubtext, sectionCopy, trustFacts } from '@/components/home/homeView';
import { JsonLd } from '@/components/seo/JsonLd';
import { buttonClasses } from '@/components/ui/Button';
import { ExperienceRoot } from '@/experience/ExperienceRoot';
import { t } from '@/i18n/fa';
import { siteCapFrom } from '@/lib/qualityTier';
import { faqPageNode, jsonLdGraph } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';
import type { Media, Page } from '@/payload-types';

export async function generateMetadata(): Promise<Metadata> {
  const [page, { seo }] = await Promise.all([getHomePage(), getSiteInputs()]);
  return buildMetadata(
    { path: '/', title: page?.title ?? seo.siteName, seo: pageSeoFrom(page?.seo), kind: 'home' },
    seo,
  );
}

type Blocks = NonNullable<Page['blocks']>;

function block<T extends Blocks[number]['blockType']>(page: Page | null, type: T) {
  return page?.blocks?.find(
    (b): b is Extract<Blocks[number], { blockType: T }> => b.blockType === type,
  );
}

const mediaOf = (value: number | Media | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null;

export default async function HomePage() {
  const [data, nonce] = await Promise.all([
    getHomeData(),
    headers().then((h) => h.get('x-nonce') ?? undefined),
  ]);
  const { page, features, clinic } = data;
  const siteCap = siteCapFrom(features.qualityTierOverride);
  const free = features.freeConsultation !== false;
  const steps = (block(page, 'steps')?.items ?? []).map(({ title, text }) => ({ title, text }));
  const faqs = (block(page, 'faq')?.items ?? []).map(({ question, answer }) => ({
    question,
    answer,
  }));
  const whatsapp =
    clinic.phones.whatsappVerified && clinic.phones.whatsapp
      ? `https://wa.me/${clinic.phones.whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(t('home.whatsappText'))}`
      : null;
  return (
    <ExperienceRoot
      siteCap={siteCap}
      notice={
        <LightNotice
          labels={{
            loaded: t('home.light.loaded'),
            stepped: t('home.light.stepped'),
            on: t('home.light.on'),
            off: t('home.light.off'),
            turnOn: t('home.light.turnOn'),
            turnOff: t('home.light.turnOff'),
            dismiss: t('home.light.dismiss'),
          }}
          buttonClass={{ toggle: buttonClasses('secondary'), dismiss: buttonClasses('ghost') }}
        />
      }
    >
      <div data-page-type="home">
        {/* Phase 7: the lockup parts once (the intro and the playground use them), then the intro
            overlay (none when the site cap is 0: no experience, no brand moment); its script
            follows the hero's first row. */}
        <LockupSprite />
        {siteCap === 0 ? null : <IntroOverlay nonce={nonce} />}
        <HomeHero
          title={page?.title ?? clinic.nameFa}
          subtext={heroSubtext(page, free)}
          image={heroImage(mediaOf(page?.hero?.photo), mediaOf(page?.hero?.photoPortrait))}
          relief={features.heroMarkRelief !== false}
          phone={clinic.phones.landline}
          facts={trustFacts({
            freeConsultation: free,
            hours: data.hours,
            callbackMinutes: clinic.reception.callbackMinutes,
            insurers: data.insurers,
          })}
          intro={siteCap === 0 ? null : <IntroScript nonce={nonce} />}
        />
        <ServicesSection tree={data.tree} copy={sectionCopy(page, 'services')} />
        <RestorationSection
          tiers={data.tiers}
          path={data.restoration?.path ?? null}
          copy={sectionCopy(page, 'restoration')}
        />
        <WorkflowSection
          items={block(page, 'workflow')?.items ?? []}
          copy={sectionCopy(page, 'workflow')}
        />
        {data.demo.cases ? (
          <DemoCasesSection copy={sectionCopy(page, 'compare')} />
        ) : (
          <CasesSection cases={data.cases} copy={sectionCopy(page, 'compare')} />
        )}
        {data.demo.dentists ? (
          <DemoDentistsSection copy={sectionCopy(page, 'dentists')} />
        ) : (
          <DentistsSection doctors={data.doctors} copy={sectionCopy(page, 'dentists')} />
        )}
        {data.demo.voices ? (
          <DemoVoicesSection copy={sectionCopy(page, 'voices')} />
        ) : (
          <VoicesSection testimonials={data.testimonials} copy={sectionCopy(page, 'voices')} />
        )}
        {/* Scene 9 holds the first visit and the FAQ (experience-direction 2). */}
        <div data-scene="first-visit">
          <JourneySection
            steps={steps}
            guidePath={data.firstVisitGuide}
            copy={sectionCopy(page, 'journey')}
          />
          <FaqSection
            faqs={faqs}
            copy={sectionCopy(page, 'faq')}
            phone={clinic.phones.landline}
            whatsapp={whatsapp}
          />
        </div>
        <BookingSection clinic={clinic} hours={data.hours} />
        <PlaygroundSection />
      </div>
      <HomeBookingPrefill />
      <JsonLd data={faqs.length ? jsonLdGraph(faqPageNode(faqs)) : null} />
    </ExperienceRoot>
  );
}
