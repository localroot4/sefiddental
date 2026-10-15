import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/JsonLd';
import { ButtonLink } from '@/components/ui/Button';
import { MapBlock, PhoneNumber } from '@/components/ui/Contact';
import { hoursBadgeLabels, HoursTable } from '@/components/ui/Hours';
import { HoursBadge } from '@/components/ui/HoursBadge';
import { Icon } from '@/components/ui/Icon';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { toClinicHours } from '@/lib/data/clinicHours';
import { getClinic } from '@/lib/data/globals';
import { PAGE_PATHS } from '@/lib/paths';
import { hoursNote, type HoursStateName } from '@/lib/hoursState';
import { telHref } from '@/lib/phone';
import { breadcrumbNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { LiveHours } from './LiveHours';
import { Band, MapImage, PageBooking, TextPlaceholder } from './parts';
import { paragraphs, telegramHref, whatsappHref } from './view';

const WAYFINDING = [
  'pages.photo.building',
  'pages.photo.entrance',
  'pages.photo.alley',
  'pages.photo.parking',
] as const;

/** Every HoursBadge, rendered here so the LiveHours island imports no labels or icon code (F2). */
function hoursBadges(): Record<HoursStateName | 'pending', ReactNode> {
  const labels = hoursBadgeLabels();
  const icon = <Icon name="clock" size="sm" />;
  const states = [null, ...(Object.keys(labels) as HoursStateName[])];
  return Object.fromEntries(
    states.map((state) => [
      state ?? 'pending',
      <HoursBadge key={state} state={state} labels={labels} icon={icon} />,
    ]),
  ) as Record<HoursStateName | 'pending', ReactNode>;
}

/**
 * T-address (docs/ia.md): NAP, hours with today's live state, call, WhatsApp and directions next
 * to the static map (A); access notes and wayfinding photos (K); the booking form without a
 * second map (J-form). The clinic's contact headline is the hero's short label, not a second H1
 * (templates C13). Phones are LTR islands; WhatsApp and Telegram wait for the verified number (F12).
 */
export async function Address({ page }: { page: Page }) {
  const clinic = await getClinic();
  const { address, phones } = clinic;
  const hours = toClinicHours(clinic);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: page.title, href: PAGE_PATHS.address },
  ];
  const whatsapp = whatsappHref(phones);
  const telegram = telegramHref(phones);
  const access = paragraphs(address.accessNotes);
  return (
    <div data-page-type="address">
      <PageHero
        titleSize={heroTitleSize(page.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        label={clinic.contactHeadline ?? undefined}
        title={page.title}
        summary={page.lead ?? undefined}
        actions={
          <>
            <ButtonLink
              size="lg"
              href={telHref(phones.landline)}
              iconStart={<Icon name="phone" size="sm" />}
              track={{ event: 'call_click', location: 'hero' }}
              data-call-sheet=""
            >
              {t('call.label')}
            </ButtonLink>
            {whatsapp ? (
              <ButtonLink
                variant="secondary"
                size="lg"
                href={whatsapp}
                iconStart={<Icon name="whatsapp" size="sm" />}
                track={{ event: 'whatsapp_click', location: 'hero' }}
              >
                {t('pages.whatsapp')}
              </ButtonLink>
            ) : null}
          </>
        }
        note={
          <dl data-section="contact" className="grid w-full gap-6 pt-2 md:max-w-[28rem]">
            <div className="grid gap-1">
              <dt className="text-small font-semibold">{t('pages.address.address')}</dt>
              <dd className="text-body">{address.fullFa}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-small font-semibold">{t('pages.address.phones')}</dt>
              <dd className="flex flex-wrap items-center gap-x-6">
                <span className="inline-flex items-center gap-1 text-small text-ink-muted">
                  {t('pages.address.landline')}
                  <PhoneNumber
                    e164={phones.landline}
                    link
                    standalone
                    track={{ event: 'call_click', location: 'page' }}
                  />
                </span>
                {phones.mobile ? (
                  <span className="inline-flex items-center gap-1 text-small text-ink-muted">
                    {t('pages.address.mobile')}
                    <PhoneNumber
                      e164={phones.mobile}
                      link
                      standalone
                      track={{ event: 'call_click', location: 'page' }}
                    />
                  </span>
                ) : null}
              </dd>
              {telegram ? (
                <dd>
                  <TextLink standalone href={telegram} className="-ms-2">
                    {t('pages.telegram')}
                  </TextLink>
                </dd>
              ) : null}
            </div>
            <div className="grid gap-1">
              <dt className="text-small font-semibold">{t('pages.address.hours')}</dt>
              <dd>
                <HoursTable
                  hours={hours}
                  status={<LiveHours badges={hoursBadges()} />}
                  note={hoursNote(hours)}
                />
              </dd>
            </div>
          </dl>
        }
        media={
          <MapBlock
            image={<MapImage clinic={clinic} sizes="(min-width: 744px) 30rem, 100vw" />}
            maps={clinic.maps}
            location="hero"
          />
        }
      />
      <Band id="access" family="K" title={t('pages.address.access')} tone="sunken">
        <div className="grid gap-8">
          {access.length ? (
            <div className="grid max-w-measure gap-4 text-body-lg">
              {access.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <TextPlaceholder caption={t('pages.address.accessPending')} />
          )}
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {WAYFINDING.map((key) => (
              <li key={key}>
                <MediaPlaceholder caption={t(key)} variant="standalone" ratio="4:3" />
              </li>
            ))}
          </ul>
        </div>
      </Band>
      <PageBooking clinic={clinic} map={false} />
      <JsonLd
        data={jsonLdGraph(breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))))}
      />
    </div>
  );
}
