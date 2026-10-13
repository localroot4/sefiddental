import Link from 'next/link';
import type { ReactNode } from 'react';

import { CallBlock } from '@/components/layout/CallBlock';
import { EMERGENCY_PATH, SYSTEM_LINKS, t } from '@/i18n/fa';

/** Chevron toward the reading end (left in RTL). */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6 shrink-0 text-ink-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

/**
 * Template T-system (ia.md 6, DESIGN.md): one H1, a lead, optional actions, the call block,
 * links to the service hubs and, on the 404, «درد شدید دارید؟». Presentational only, so the 404
 * (server) and the 500 boundary (client) share it; it reads no data and works with the database
 * down.
 */
export function SystemPage(props: {
  heading: string;
  lead: string;
  children?: ReactNode;
  showLinks?: boolean;
  showUrgent?: boolean;
}) {
  return (
    <section
      aria-labelledby="system-heading"
      className="mx-auto w-full max-w-content px-gutter py-section"
    >
      <div className="max-w-measure">
        <h1 id="system-heading" className="font-display text-display-2 text-ink">
          {props.heading}
        </h1>
        <p className="mt-4 text-body-lg text-ink-muted">{props.lead}</p>
        {props.children ? (
          <div className="mt-8 flex flex-col items-start gap-3">{props.children}</div>
        ) : null}
        <div className="mt-8">
          <CallBlock />
        </div>
        {props.showLinks ? (
          <nav aria-labelledby="system-links" className="mt-12">
            <h2 id="system-links" className="text-small text-ink-muted">
              {t('links.heading')}
            </h2>
            <ul className="mt-2 border-t border-line">
              {SYSTEM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="flex min-h-12 items-center justify-between gap-4 border-b border-line text-ink transition-colors duration-200 hover:text-brand motion-reduce:transition-none"
                  >
                    {link.label}
                    <Chevron />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {props.showUrgent ? (
          <Link
            href={EMERGENCY_PATH}
            prefetch={false}
            className="mt-6 inline-flex min-h-target items-center font-bold text-warning hover:underline"
          >
            {t('urgent.label')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
