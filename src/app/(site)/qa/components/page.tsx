import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/Alert';
import { ArticleMeta, SourceList, Toc } from '@/components/ui/Article';
import { Badge, Tag } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton, Spinner } from '@/components/ui/Button';
import { CardRail, CategoryTile, DentistCard, ServiceCard, TileGrid } from '@/components/ui/Cards';
import { CompareSlider } from '@/components/ui/CompareSlider';
import { MapBlock, PhoneNumber } from '@/components/ui/Contact';
import { FactsRow, FaqList, Quote, Steps } from '@/components/ui/Content';
import {
  EmptyState,
  Loading,
  Skeleton,
  SkeletonCard,
  SuccessCheck,
  Toast,
} from '@/components/ui/Feedback';
import { ChipGroup, TextAreaField, TextField } from '@/components/ui/Field';
import { HoursTable, hoursBadgeLabels } from '@/components/ui/Hours';
import { HoursBadge } from '@/components/ui/HoursBadge';
import { Icon } from '@/components/ui/Icon';
import { PageHero, Section, SectionHeader } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs, Pagination } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { TextLink } from '@/components/ui/TextLink';
import { TierComparison } from '@/components/ui/Tiers';
import { CLINIC_FALLBACK, t } from '@/i18n/fa';
import { readEnv } from '@/lib/env';
import type { ClinicHours } from '@/lib/hoursState';
import { toPersianDigits } from '@/lib/persianText';
import { PHONE_ERRORS } from '@/lib/phone';
import type { Media } from '@/payload-types';

// Every ui component in every state that markup can show, for the phase 4 screenshots (390,
// 820, 1440; light and dark) and axe. QA_ROUTES=1 only, read at request time; otherwise a real
// 404 (same guard as /qa/not-found). Hover, focus and press are checked interactively.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t('ui.qa.title'),
  description: t('ui.qa.lead'),
  robots: { index: false, follow: false },
};

const EVERY_DAY: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  holidays: [],
  noteFa: '',
};

const SPLIT_WEEK: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed'], open: '10:00', close: '20:00' },
    { days: ['thu'], open: '10:00', close: '14:30' },
  ],
  holidays: [],
  noteFa: '',
};

// A brand raster from this origin stands in for a Payload upload (no media in the QA database).
const SAMPLE_MEDIA = {
  id: 0,
  alt: t('ui.qa.photoBrand'),
  url: '/brand/og/default.png',
  width: 1200,
  height: 630,
  updatedAt: '2026-10-15T00:00:00.000Z',
  createdAt: '2026-10-15T00:00:00.000Z',
} satisfies Media;

const SAMPLE_MAPS = {
  googleMapsUrl: 'https://www.google.com/maps',
  neshanUrl: 'https://neshan.org/maps',
  baladUrl: 'https://balad.ir',
  wazeUrl: 'https://www.waze.com/live-map',
};

function Specimen(props: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={props.className}>
      <p className="mb-3 text-caption text-ink-muted">{props.label}</p>
      {props.children}
    </div>
  );
}

function GallerySection(props: {
  id: string;
  title: string;
  tone?: 'sunken' | 'warm';
  children: ReactNode;
}) {
  return (
    <Section labelledBy={props.id} tone={props.tone} className="border-t border-line">
      <SectionHeader id={props.id} title={props.title} />
      <div className="grid gap-12">{props.children}</div>
    </Section>
  );
}

const crumbs = [
  { label: t('ui.qa.home'), href: '/' },
  { label: t('ui.qa.services'), href: '/خدمات' },
  { label: t('ui.qa.category'), href: '/خدمات/زیبایی' },
  { label: t('ui.qa.service') },
];

export default function QaComponents() {
  if (!readEnv().qaRoutes) notFound();
  const badgeLabels = hoursBadgeLabels();
  const clock = <Icon name="clock" size="sm" />;
  return (
    <div data-page-type="other">
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: t('ui.qa.home'), href: '/' }, { label: t('ui.qa.title') }]}
          />
        }
        label={t('ui.qa.sample')}
        title={t('ui.qa.title')}
        summary={t('ui.qa.lead')}
        actions={
          <>
            <ButtonLink href="/رزرو-نوبت" size="lg">
              {t('ui.qa.book')}
            </ButtonLink>
            <ButtonLink href={`tel:${CLINIC_FALLBACK.phoneE164}`} size="lg" variant="secondary">
              {t('call.label')}
            </ButtonLink>
          </>
        }
        note={
          <a
            href="/اورژانس"
            className="text-small font-semibold text-warning underline underline-offset-[.22em]"
          >
            {t('urgent.label')}
          </a>
        }
        media={
          <MediaFrame ratio="hero">
            <MediaPlaceholder caption={t('ui.qa.photoLandscape')} />
          </MediaFrame>
        }
      />

      <GallerySection id="qa-buttons" title={t('ui.qa.buttons')}>
        <Specimen label={t('ui.qa.stateDefault')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">{t('ui.qa.book')}</Button>
            <Button size="lg" variant="secondary">
              {t('call.label')}
            </Button>
            <Button variant="primary">{t('ui.qa.book')}</Button>
            <Button variant="secondary">{t('call.label')}</Button>
            <Button variant="ghost">{t('ui.directions.label')}</Button>
            <Button variant="danger">{t('ui.qa.delete')}</Button>
          </div>
        </Specimen>
        <Specimen label={t('ui.qa.stateIcons')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" iconStart={<Icon name="calendar" size="sm" />}>
              {t('ui.qa.book')}
            </Button>
            <Button size="lg" variant="secondary" iconStart={<Icon name="phone" size="sm" />}>
              {t('call.label')}
            </Button>
            <Button variant="ghost" iconStart={<Icon name="whatsapp" size="sm" />}>
              {t('ui.qa.whatsapp')}
            </Button>
            <ButtonLink
              href="/خدمات"
              variant="secondary"
              iconEnd={<Icon name="arrow-forward" size="sm" />}
            >
              {t('ui.qa.allServices')}
            </ButtonLink>
          </div>
        </Specimen>
        <Specimen label={`${t('ui.loading')} / ${t('ui.qa.stateDisabled')}`}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" type="submit" loading>
              {t('ui.qa.submitting')}
            </Button>
            <Button size="lg" disabled>
              {t('ui.qa.submit')}
            </Button>
            <Button variant="secondary" disabled>
              {t('call.label')}
            </Button>
            <ButtonLink href="/رزرو-نوبت" disabled>
              {t('ui.qa.book')}
            </ButtonLink>
            <Spinner className="text-brand" />
          </div>
        </Specimen>
        <Specimen label={t('ui.qa.stateIconOnly')}>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label={t('theme.toggle')} icon={<Icon name="sun" />} />
            <IconButton
              label={t('call.label')}
              icon={<Icon name="phone" />}
              href={`tel:${CLINIC_FALLBACK.phoneE164}`}
            />
            <IconButton label={t('ui.qa.menuOpen')} icon={<Icon name="menu" />} />
            <IconButton label={t('ui.qa.menuClose')} icon={<Icon name="close" />} />
            <IconButton label={t('ui.qa.instagram')} icon={<Icon name="instagram" />} />
            <IconButton label={t('ui.qa.telegram')} icon={<Icon name="telegram" />} />
            <IconButton label={t('ui.qa.whatsapp')} icon={<Icon name="whatsapp" />} />
            <IconButton label={t('ui.qa.menuClose')} icon={<Icon name="close" />} disabled />
          </div>
        </Specimen>
        <div className="max-w-[26rem]">
          <Button size="lg" type="submit" fullWidth>
            {t('ui.qa.submit')}
          </Button>
        </div>
      </GallerySection>

      <GallerySection id="qa-links" title={t('ui.qa.links')}>
        <p className="max-w-measure">
          {t('ui.qa.linkSentence')}{' '}
          <TextLink href="/راهنمای-بیمار">{t('ui.qa.linkLabel')}</TextLink>
        </p>
        <div className="flex flex-wrap items-center gap-x-6">
          <TextLink href="/خدمات" standalone>
            {t('ui.qa.allServices')}
          </TextLink>
          <PhoneNumber e164={CLINIC_FALLBACK.phoneE164} link standalone />
          <PhoneNumber e164="+989205451054" />
        </div>
      </GallerySection>

      {/* A second H1 on this QA page only: the compact (hub) hero is a specimen. */}
      <GallerySection id="qa-layout" title={t('ui.qa.layout')} tone="sunken">
        <PageHero
          compact
          breadcrumbs={
            <Breadcrumbs
              items={[{ label: t('ui.qa.home'), href: '/' }, { label: t('ui.qa.services') }]}
            />
          }
          title={t('ui.qa.services')}
          summary={t('ui.qa.lead')}
          actions={
            <ButtonLink href="/رزرو-نوبت" size="lg">
              {t('ui.qa.book')}
            </ButtonLink>
          }
        />
      </GallerySection>

      <GallerySection id="qa-form" title={t('ui.qa.form')} tone="warm">
        <div className="grid gap-8 md:grid-cols-2">
          <TextField
            id="qa-phone"
            name="phone"
            kind="tel"
            label={t('ui.qa.phoneLabel')}
            help={
              <>
                {t('booking.phoneHelp')} <bdi dir="ltr">{t('booking.phoneSample')}</bdi>
              </>
            }
            required
          />
          <TextField
            id="qa-phone-error"
            name="phone-error"
            kind="tel"
            label={t('ui.qa.phoneLabel')}
            help={
              <>
                {t('booking.phoneHelp')} <bdi dir="ltr">{t('booking.phoneSample')}</bdi>
              </>
            }
            error={PHONE_ERRORS.invalid}
            defaultValue={toPersianDigits('0912')}
            required
          />
          <TextField id="qa-name" name="name" label={t('ui.qa.nameLabel')} autoComplete="name" />
          <TextField
            id="qa-name-disabled"
            name="name-disabled"
            label={t('ui.qa.nameLabel')}
            disabled
          />
          <TextField
            id="qa-phone-empty"
            name="phone-empty"
            kind="tel"
            label={t('ui.qa.phoneLabel')}
            error={PHONE_ERRORS.empty}
          />
          <TextAreaField
            id="qa-note"
            name="note"
            label={t('ui.qa.noteLabel')}
            help={t('ui.qa.noteHelp')}
            counter={toPersianDigits('0/500')}
            maxLength={500}
          />
          <TextAreaField
            id="qa-note-error"
            name="note-error"
            label={t('ui.qa.noteLabel')}
            error={t('ui.qa.noteError')}
            counter={toPersianDigits('504/500')}
          />
          <ChipGroup
            legend={t('ui.qa.serviceLegend')}
            name="qa-service"
            defaultValue="exam"
            options={[
              { value: 'exam', label: t('ui.qa.chipExam') },
              { value: 'cosmetic', label: t('ui.qa.chipCosmetic') },
              { value: 'implant', label: t('ui.qa.chipImplant') },
              { value: 'other', label: t('ui.qa.chipOther') },
            ]}
          />
          <ChipGroup
            legend={t('ui.qa.timeLegend')}
            name="qa-time"
            options={[
              { value: 'morning', label: t('ui.qa.chipMorning') },
              { value: 'evening', label: t('ui.qa.chipEvening') },
              { value: 'any', label: t('ui.qa.chipAny'), disabled: true },
            ]}
          />
        </div>
      </GallerySection>

      <GallerySection id="qa-feedback" title={t('ui.qa.feedback')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Alert tone="info" title={t('ui.qa.alertInfoTitle')} />
          <Alert tone="success" title={t('ui.qa.alertSuccessTitle')} />
          <Alert tone="warning" title={t('ui.qa.alertWarningTitle')}>
            {CLINIC_FALLBACK.hoursLine}
          </Alert>
          <Alert tone="danger" title={t('ui.qa.alertDangerTitle')}>
            {t('ui.qa.alertBody')}
          </Alert>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <SuccessCheck />
          <SuccessCheck compact />
        </div>
        {/* A transformed box contains the fixed toast, so it shows here instead of over the page. */}
        <div className="relative h-[9rem] [transform:translateZ(0)]">
          <Toast open>{t('ui.qa.toast')}</Toast>
        </div>
      </GallerySection>

      <GallerySection id="qa-states" title={t('ui.qa.states')}>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Loading label={t('ui.loading')} className="grid content-start gap-3">
            <Skeleton className="h-8 w-[70%]" />
            <Skeleton className="h-[.9rem]" />
            <Skeleton className="h-[.9rem] w-[85%]" />
            <HoursBadge state={null} labels={badgeLabels} icon={clock} />
          </Loading>
          <Loading label={t('ui.loading')}>
            <SkeletonCard />
          </Loading>
          <EmptyState
            action={
              <ButtonLink href="/قبل-و-بعد" variant="secondary">
                {t('ui.qa.emptyAction')}
              </ButtonLink>
            }
          >
            {t('ui.qa.empty')}
          </EmptyState>
        </div>
      </GallerySection>

      <GallerySection id="qa-navigation" title={t('ui.qa.navigation')}>
        <Breadcrumbs items={crumbs} />
        <div className="grid gap-4">
          <Pagination current={1} total={3} href={(n) => `?page=${n}`} />
          <Pagination current={5} total={12} href={(n) => `?page=${n}`} />
          <Pagination current={12} total={12} href={(n) => `?page=${n}`} />
        </div>
      </GallerySection>

      <GallerySection id="qa-facts" title={t('ui.qa.facts')}>
        <FactsRow
          facts={[
            { value: t('ui.qa.fact1'), caption: t('ui.qa.sample') },
            { value: t('ui.qa.fact2'), caption: t('ui.qa.fact2Caption') },
            { value: t('ui.qa.fact3'), caption: t('ui.qa.fact3Caption') },
            { value: t('ui.qa.fact4'), caption: t('ui.qa.fact4Caption') },
          ]}
        />
        <FactsRow
          facts={[
            { value: t('ui.qa.fact2'), caption: t('ui.qa.fact2Caption') },
            { value: t('ui.qa.fact3'), caption: t('ui.qa.fact3Caption') },
            { value: t('ui.qa.fact4') },
          ]}
        />
      </GallerySection>

      <GallerySection id="qa-faq" title={t('ui.qa.faq')}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FaqList
            items={[
              { question: t('ui.qa.faqQ1'), answer: t('ui.qa.faqA1'), open: true },
              { question: t('ui.qa.faqQ2'), answer: t('ui.qa.faqA2') },
            ]}
          />
          <Steps
            items={[
              { title: t('ui.qa.step1'), text: t('ui.qa.step1Text') },
              { title: t('ui.qa.step2'), text: t('ui.qa.step2Text') },
              { title: t('ui.qa.step3'), text: t('ui.qa.step3Text') },
            ]}
          />
        </div>
      </GallerySection>

      <GallerySection id="qa-media" title={t('ui.qa.media')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MediaFrame ratio="4:5">
            <MediaPlaceholder caption={t('ui.qa.photoPortrait')} />
          </MediaFrame>
          <MediaFrame ratio="1:1">
            <MediaPlaceholder caption={t('ui.qa.photoBefore')} />
          </MediaFrame>
          <MediaFrame ratio="4:3" className="col-span-2">
            <Picture media={SAMPLE_MEDIA} sizes="(min-width: 1024px) 40vw, 100vw" />
          </MediaFrame>
        </div>
        <MediaPlaceholder
          variant="standalone"
          ratio="3:2"
          caption={t('ui.qa.photoLandscape')}
          className="max-w-[30rem]"
        />
      </GallerySection>

      <GallerySection id="qa-cards" title={t('ui.qa.cards')}>
        <TileGrid>
          <CategoryTile
            featured
            href="/خدمات/زیبایی"
            accent="cosmetic"
            title={t('ui.qa.tileCosmetic')}
            list={t('ui.qa.tileList')}
            count={t('ui.qa.sample')}
            media={<MediaPlaceholder caption={t('ui.qa.photoCard')} />}
          />
          <CategoryTile
            href="/خدمات/جراحی-و-جایگزینی-دندان"
            accent="surgery"
            title={t('ui.qa.tileSurgery')}
            count={t('ui.qa.sample')}
          />
          <CategoryTile
            href="/خدمات/درمان-دندان"
            accent="restorative"
            title={t('ui.qa.tileRestorative')}
            count={t('ui.qa.sample')}
          />
          <CategoryTile
            href="/خدمات/ارتودنسی"
            accent="ortho"
            icon="smiley"
            title={t('ui.qa.tileOrtho')}
          />
          <CategoryTile href="/خدمات/دندانپزشکی-کودکان" accent="kids" title={t('ui.qa.tileKids')} />
        </TileGrid>
        <div className="grid gap-4 md:grid-cols-2">
          <ServiceCard
            href="/خدمات/لمینت-سرامیکی"
            accent="cosmetic"
            title={t('ui.qa.service')}
            line={t('ui.qa.cardLine')}
            facts={[t('ui.qa.cardFact1'), t('ui.qa.cardFact2')]}
            linkText={t('ui.qa.cardLink')}
            media={<MediaPlaceholder variant="card" caption={t('ui.qa.photoCard')} />}
          />
          <ServiceCard
            href="/خدمات/جرم-گیری"
            accent="restorative"
            title={t('ui.qa.tileRestorative')}
            line={t('ui.qa.sample')}
            media={<MediaPlaceholder variant="card" caption={t('ui.qa.photoCard')} />}
          />
        </div>
        <CardRail label={t('ui.qa.cards')}>
          <DentistCard
            name={t('ui.qa.sample')}
            specialty={t('ui.qa.sample')}
            councilLabel={t('ui.dentist.council')}
            councilNumber={toPersianDigits('00000')}
            href="/پزشکان"
            media={<MediaPlaceholder variant="card" caption={t('ui.qa.photoPortrait')} />}
          />
          <DentistCard
            name={t('ui.qa.sample')}
            media={<MediaPlaceholder variant="card" caption={t('ui.qa.photoPortrait')} />}
          />
        </CardRail>
      </GallerySection>

      <GallerySection id="qa-tiers" title={t('ui.qa.tiers')}>
        <TierComparison
          label={t('ui.qa.tiers')}
          selectedKey="vip"
          selectedLabel={t('ui.qa.stateSelected')}
          tiers={[
            {
              key: 'standard',
              name: t('ui.qa.tierStandard'),
              summary: t('ui.qa.sample'),
              rows: [{ term: t('ui.qa.tierTerm'), value: t('ui.qa.sample') }],
            },
            {
              key: 'vip',
              name: t('ui.qa.tierVip'),
              summary: t('ui.qa.sample'),
              rows: [{ term: t('ui.qa.tierTerm'), value: t('ui.qa.sample') }],
              action: (
                <ButtonLink href="/رزرو-نوبت?service=restoration&tier=vip">
                  {t('ui.qa.book')}
                </ButtonLink>
              ),
            },
            {
              key: 'cip',
              name: t('ui.qa.tierCip'),
              summary: t('ui.qa.sample'),
              rows: [{ term: t('ui.qa.tierTerm'), value: t('ui.qa.sample') }],
            },
          ]}
        />
      </GallerySection>

      <GallerySection id="qa-compare" title={t('ui.qa.compare')}>
        <div className="grid gap-3">
          <CompareSlider
            handle={
              <>
                <Icon name="caret-back" size="sm" className="-me-1" />
                <Icon name="caret-forward" size="sm" className="-ms-1" />
              </>
            }
            before={<MediaPlaceholder caption={t('ui.qa.photoBefore')} />}
            after={<MediaPlaceholder caption={t('ui.qa.photoAfter')} />}
            labels={{
              before: t('ui.compare.before'),
              after: t('ui.compare.after'),
              slider: t('ui.compare.label'),
              percent: t('ui.compare.percent'),
            }}
          />
          <p className="max-w-measure text-small text-ink-muted">{t('ui.compare.consent')}</p>
        </div>
      </GallerySection>

      <GallerySection id="qa-hours" title={t('ui.qa.hours')}>
        <div className="grid gap-12 md:grid-cols-2">
          <HoursTable
            hours={EVERY_DAY}
            status={<HoursBadge state="open" labels={badgeLabels} icon={clock} />}
            note={CLINIC_FALLBACK.hoursLine}
          />
          <HoursTable
            hours={SPLIT_WEEK}
            status={<HoursBadge state="closed" labels={badgeLabels} icon={clock} />}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(['open', 'closing-soon', 'before-open', 'closed', 'holiday'] as const).map((state) => (
            <HoursBadge key={state} state={state} labels={badgeLabels} icon={clock} />
          ))}
        </div>
        <MapBlock
          className="max-w-[36rem]"
          maps={SAMPLE_MAPS}
          image={<MediaPlaceholder caption={t('ui.qa.photoMap')} />}
        />
      </GallerySection>

      <GallerySection id="qa-tags" title={t('ui.qa.tags')}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="warm">{t('ui.qa.stateSelected')}</Badge>
          <Badge tone="emergency">{t('urgent.label')}</Badge>
          <Badge>{t('ui.qa.sample')}</Badge>
          <Tag>{t('ui.qa.category')}</Tag>
          <Tag href="/خدمات/زیبایی">{t('ui.qa.service')}</Tag>
        </div>
      </GallerySection>

      <GallerySection id="qa-quotes" title={t('ui.qa.quotes')}>
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <Quote cite={t('ui.qa.sample')}>{t('ui.qa.quote')}</Quote>
          <TestimonialCard
            label={t('ui.qa.sample')}
            consent={t('ui.qa.sample')}
            media={<MediaPlaceholder caption={t('ui.qa.photoVideo')} />}
          />
        </div>
      </GallerySection>

      <GallerySection id="qa-article" title={t('ui.qa.article')}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="grid gap-8">
            <ArticleMeta
              updatedAt="2026-10-12T08:00:00Z"
              readingMinutes={4}
              reviewer={t('ui.qa.sample')}
            />
            <Alert tone="info" title={t('ui.qa.sample')}>
              {t('ui.qa.faqA1')}
            </Alert>
            <SourceList
              id="qa-sources"
              items={[
                {
                  label: 'American Dental Association: Dental Fillings',
                  href: 'https://www.ada.org',
                },
                { label: 'NHS: Fillings', href: 'https://www.nhs.uk' },
              ]}
            />
          </div>
          <Toc
            items={[
              { id: 'qa-buttons', label: t('ui.qa.buttons') },
              { id: 'qa-form', label: t('ui.qa.form') },
              { id: 'qa-cards', label: t('ui.qa.cards') },
            ]}
          />
        </div>
      </GallerySection>
    </div>
  );
}
