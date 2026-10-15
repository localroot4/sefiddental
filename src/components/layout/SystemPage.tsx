import type { ReactNode } from 'react';

import { SYSTEM_LINKS } from '@/i18n/fa-system';

/**
 * Template T-system (ia.md 6, DESIGN.md 3.33): one H1, a lead, optional actions, the call block,
 * links to the service hubs and, on the 404, «درد شدید دارید؟». Presentational only, so the 404
 * (server) and the 500 boundary (client) share it; it reads no data and works with the database
 * down. Labels and glyphs are props: the boundary loads on every page and must not pull in
 * src/i18n/fa.ts or icon code (F1, F2). Plain links: a prefetch would render a dynamic page on
 * the server.
 */
export function SystemPage(props: {
  heading: string;
  lead: string;
  /** The CallBlock; on the 404 it leads with «رزرو نوبت» (C8). */
  call: ReactNode;
  linksHeading: string;
  linkIcon?: ReactNode;
  children?: ReactNode;
  urgent?: ReactNode;
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
        <div className="mt-8">{props.call}</div>
        <nav aria-labelledby="system-links" className="mt-12">
          <h2 id="system-links" className="text-small text-ink-muted">
            {props.linksHeading}
          </h2>
          <ul className="mt-2 border-t border-line">
            {SYSTEM_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="flex min-h-12 items-center justify-between gap-4 border-b border-line text-ink transition-colors hover:text-brand-strong"
                >
                  {link.label}
                  {props.linkIcon}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {props.urgent}
      </div>
    </section>
  );
}
