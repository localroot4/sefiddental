import type { ReactNode } from 'react';

import { cx } from './cx';

/**
 * Testimonial card (DESIGN.md 3.22, family H): a self-hosted video in a 4:5 frame (studio
 * decision, Q-11) that streams only on play (`preload="none"`, poster first), the patient's label
 * and the consent line. Native controls give the play button, keyboard and the captions menu;
 * the Persian captions track is required (WCAG 1.2.2) and on by default. No third-party player.
 * Without a video the caller passes a placeholder as `media`.
 */
export function TestimonialCard(props: {
  label: ReactNode;
  consent: ReactNode;
  video?: {
    src: string;
    type?: string;
    poster?: string | null;
    title: string;
    captions: { src: string; srclang: 'fa'; label: string };
  };
  media?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cx('grid content-start gap-3', props.className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-media bg-surface-sunken">
        {props.video ? (
          <video
            controls
            playsInline
            preload="none"
            poster={props.video.poster ?? undefined}
            aria-label={props.video.title}
            className="size-full object-cover"
          >
            <source src={props.video.src} type={props.video.type ?? 'video/mp4'} />
            <track
              kind="captions"
              default
              src={props.video.captions.src}
              srcLang={props.video.captions.srclang}
              label={props.video.captions.label}
            />
          </video>
        ) : (
          props.media
        )}
      </div>
      <figcaption className="grid gap-1">
        <span className="text-body leading-[1.5] font-semibold">{props.label}</span>
        <span className="text-caption text-ink-muted">{props.consent}</span>
      </figcaption>
    </figure>
  );
}
