// Home (docs/ia.md T-home, freeze F4): the ten sections in reading order, hero B, and the static
// version of every scene (tier 0). The server HTML is the complete page; ExperienceRoot adds the
// scroll engine and the canvas after hydration, and phases 7 and 8 animate this markup through
// its [data-scene] hooks.
import type { Metadata } from 'next';

import { HomeBookingPrefill } from '@/components/home/HomeBookingPrefill';
import { HomeHero } from '@/components/home/HomeHero';
import {
  BookingSection,
  CasesSection,
  DentistsSection,
  FaqSection,
  JourneySection,
  RestorationSection,
  ServicesSection,
  VoicesSection,
} from '@/components/home/HomeSections';
import { getHomeData, getHomePage } from '@/components/home/homeData';
import { heroImage, heroSubtext, sectionCopy, trustFacts } from '@/components/home/homeView';
import { JsonLd } from '@/components/seo/JsonLd';
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
  const data = await getHomeData();
  const { page, features, clinic } = data;
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
    <ExperienceRoot siteCap={siteCapFrom(features.qualityTierOverride)}>
      <div data-page-type="home">
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
        />
        <ServicesSection tree={data.tree} copy={sectionCopy(page, 'services')} />
        <RestorationSection
          tiers={data.tiers}
          path={data.restoration?.path ?? null}
          copy={sectionCopy(page, 'restoration')}
        />
        <CasesSection cases={data.cases} copy={sectionCopy(page, 'compare')} />
        <DentistsSection doctors={data.doctors} copy={sectionCopy(page, 'dentists')} />
        <VoicesSection testimonials={data.testimonials} copy={sectionCopy(page, 'voices')} />
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
      </div>
      <HomeBookingPrefill />
      <JsonLd data={faqs.length ? jsonLdGraph(faqPageNode(faqs)) : null} />
    </ExperienceRoot>
  );
}
