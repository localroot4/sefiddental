import { CardRail, DentistCard } from '@/components/ui/Cards';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import type { Doctor, Service } from '@/payload-types';

import { HomeSection, media, type Copy } from './HomeSection';

type HomeDoctor = Omit<Doctor, 'services'> & { services: Service[] };

/**
 * Scene 7 (family F): hidden until a dentist is published (storyboard scene 7). The portrait
 * sits in its own `[data-portrait]` box inside the card's clipped frame: `dentists.ts` moves
 * that box toward a fine pointer (at most 8 px, from 1024 px) and leaves the card itself alone.
 */
export function DentistsSection(props: { doctors: HomeDoctor[]; copy: Copy }) {
  if (props.doctors.length === 0) return null;
  return (
    <HomeSection
      scene="dentists"
      section="dentists"
      family="F"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS['dentists-hub']} className="-ms-2">
          {t('home.dentists.all')}
        </TextLink>
      }
    >
      <CardRail label={t('home.dentists.rail')}>
        {props.doctors.map((doctor) => {
          const photo = media(doctor.photo);
          return (
            <DentistCard
              key={doctor.id}
              name={`${t('home.dentists.title')} ${doctor.name}`}
              specialty={doctor.specialty}
              councilLabel={t('ui.dentist.council')}
              councilNumber={doctor.councilNumber}
              href={buildPath('doctors', doctor) ?? undefined}
              media={
                photo ? (
                  <div data-portrait="" className="size-full">
                    <Picture
                      media={photo}
                      crop="portrait"
                      sizes="(min-width: 1024px) 26rem, 84vw"
                    />
                  </div>
                ) : null
              }
            />
          );
        })}
      </CardRail>
    </HomeSection>
  );
}
