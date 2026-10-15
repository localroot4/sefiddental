import { ButtonLink } from '@/components/ui/Button';
import { CardRail, DentistCard, ServiceCard } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/Feedback';
import { MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { t } from '@/i18n/fa';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import type { Doctor } from '@/payload-types';

import { dentistName, mediaOf } from './view';

type DentistItem = Pick<Doctor, 'id' | 'name' | 'slug' | 'specialty' | 'councilNumber' | 'photo'>;

/** «رزرو نوبت» of an empty state: scrolls to the page's booking block (the chrome's route). */
function BookAction() {
  return (
    <ButtonLink
      variant="secondary"
      href={PAGE_PATHS.booking}
      track={{ event: 'booking_open', location: 'section' }}
      data-booking-cta=""
    >
      {t('pages.book')}
    </ButtonLink>
  );
}

/**
 * The dentists (family F): portrait cards linking to the profiles. With none published, one
 * sentence and one action, never a placeholder name (freeze F9, master section 3).
 */
export function DentistList(props: { doctors: DentistItem[] }) {
  if (props.doctors.length === 0) {
    return <EmptyState action={<BookAction />}>{t('pages.dentists.empty')}</EmptyState>;
  }
  return (
    // The rail's own name: the section around it is already named by its H2 (axe landmark-unique).
    <CardRail label={t('pages.dentists.rail')}>
      {props.doctors.map((doctor) => {
        const photo = mediaOf(doctor.photo);
        return (
          <DentistCard
            key={doctor.id}
            name={dentistName(doctor.name)}
            specialty={doctor.specialty}
            councilLabel={t('ui.dentist.council')}
            councilNumber={doctor.councilNumber}
            href={buildPath('doctors', doctor) ?? undefined}
            media={
              photo ? (
                <Picture media={photo} crop="portrait" sizes="(min-width: 1024px) 26rem, 84vw" />
              ) : (
                <MediaPlaceholder caption={t('pages.photo.dentist')} variant="card" />
              )
            }
          />
        );
      })}
    </CardRail>
  );
}

/** The published guides (family C), or the empty state while every guide waits for review. */
export function GuideList(props: {
  guides: Array<{ id: number; path: string; title: string; lead?: string | null }>;
}) {
  if (props.guides.length === 0) {
    return <EmptyState action={<BookAction />}>{t('pages.guides.empty')}</EmptyState>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {props.guides.map((guide) => (
        <li key={guide.id} className="grid">
          <ServiceCard href={guide.path} title={guide.title} line={guide.lead ?? undefined} />
        </li>
      ))}
    </ul>
  );
}
