import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';
import type { NavTree } from '@/lib/data/catalog';

import { MEGA_ID } from './ids';
import { pageLink } from './links';
import { NavLink, SectionButton } from './NavLink';

/** Desktop nav item: 44 px pill, the active bar under it (aria-current, DESIGN.md 3.5); a border,
 * so forced colors keep it. */
export const NAV_ITEM =
  "relative inline-flex min-h-target items-center gap-1 whitespace-nowrap rounded-pill px-3 text-small font-medium text-ink transition-colors hover:bg-brand-soft [&[aria-current]]:after:absolute [&[aria-current]]:after:inset-x-3 [&[aria-current]]:after:bottom-[2px] [&[aria-current]]:after:border-b-2 [&[aria-current]]:after:border-brand [&[aria-current]]:after:content-['']";

const ROW = 'inline-flex min-h-target items-center rounded-input px-2 -mx-2 transition-colors';
// The current page reads in weight and color, not only to screen readers (aria-current).
const CURRENT = '[&[aria-current]]:font-semibold [&[aria-current]]:text-brand-strong';
const LINK = `${ROW} ${CURRENT} text-small text-ink hover:bg-brand-soft hover:text-brand-strong`;

function Column(props: {
  id: string;
  heading: ReactNode;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <div id={props.id} className="flex min-h-target items-center font-semibold text-ink">
        {props.heading}
      </div>
      <ul aria-labelledby={props.id} className="mt-1 grid">
        {props.links.map((link) => (
          <li key={link.href}>
            <NavLink href={link.href} className={LINK}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «خدمات» and its panel (nav spec 1.3, F21): a disclosure button that opens a Popover API panel,
 * so click, Esc and light dismiss work without script; ChromeScripts adds hover intent. Columns
 * are the categories with a page (money services first), then «سایر خدمات» with the standalone
 * services and «همهٔ خدمات», then the secondary row. Labels and order come from Payload.
 */
export function MegaMenu(props: {
  nav: NavTree;
  /** The hubs with published content (JURY 4): an empty hub is no menu item. */
  hubs: { guides: boolean; articles: boolean };
}) {
  const others = [
    ...props.nav.others.map((item) => ({ href: item.path, label: item.label })),
    pageLink('services-hub'),
  ];
  const row = [
    ...(props.hubs.guides ? [pageLink('guide-hub')] : []),
    ...(props.hubs.articles ? [pageLink('articles')] : []),
    pageLink('about'),
  ];
  const urgent = pageLink('emergency');
  return (
    <li className="group/mega">
      <SectionButton
        section={pageLink('services-hub').href}
        popover={MEGA_ID}
        className={cx(NAV_ITEM, 'cursor-pointer')}
      >
        {t('nav.services')}
        <Icon
          name="caret-down"
          size="sm"
          // aria-expanded from ChromeScripts (megaMenu.ts); `:has()` only without JavaScript.
          className="text-brand transition-transform [[aria-expanded=true]>&]:rotate-180 noscript:group-has-[:popover-open]/mega:rotate-180"
        />
      </SectionButton>
      <div
        id={MEGA_ID}
        popover="auto"
        className="inset-x-0 top-nav bottom-auto mx-auto my-0 max-h-[calc(100dvh-var(--nav-h))] w-full max-w-content -translate-y-2 overflow-y-auto rounded-b-sheet border border-t-0 border-line bg-surface-raised p-0 text-ink opacity-0 shadow-floating transition-[opacity,translate,display,overlay] transition-discrete open:translate-y-0 open:opacity-100 starting:open:-translate-y-2 starting:open:opacity-0"
      >
        <div className="grid grid-cols-4 gap-8 px-gutter py-6">
          {props.nav.groups.map((group) => (
            <Column
              key={group.key}
              id={`${MEGA_ID}-${group.key}`}
              heading={
                <a
                  href={group.path}
                  className={cx(
                    ROW,
                    'font-semibold text-ink hover:bg-brand-soft hover:text-brand-strong',
                  )}
                >
                  {group.label}
                </a>
              }
              links={group.items.map((item) => ({ href: item.path, label: item.label }))}
            />
          ))}
          <Column id={`${MEGA_ID}-others`} heading={t('nav.otherServices')} links={others} />
        </div>
        <ul className="flex flex-wrap items-center gap-x-6 border-t border-line px-gutter py-2">
          {row.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} className={LINK}>
                {link.label}
              </NavLink>
            </li>
          ))}
          <li>
            <a
              href={urgent.href}
              className={cx(ROW, 'gap-2 text-small font-semibold text-warning hover:bg-brand-soft')}
            >
              <Icon name="warning" size="sm" />
              {urgent.label}
            </a>
          </li>
        </ul>
      </div>
    </li>
  );
}
