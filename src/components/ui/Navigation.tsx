import { t } from '@/i18n/fa';
import { toPersianDigits } from '@/lib/persianText';

import { cx } from './cx';
import { Icon } from './Icon';

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb (ia.md 4, DESIGN.md 3.26): «خانه» first, the current page last as
 * `aria-current="page"`. Separators are forward chevrons (mirrored in RTL). Under 744 px only the
 * parent shows, behind a back chevron. The page adds the matching BreadcrumbList JSON-LD.
 */
export function Breadcrumbs(props: { items: Crumb[]; className?: string }) {
  const last = props.items.length - 1;
  return (
    <nav aria-label={t('ui.breadcrumb.label')} className={props.className}>
      <ol className="flex flex-wrap items-center gap-1 text-small">
        {props.items.map((item, i) => {
          // On phones the parent stands alone; with a single item that item shows.
          const shownOnPhones = i === last - 1 || last === 0;
          return (
            <li
              key={`${i}-${item.label}`}
              className={cx(
                'items-center gap-1',
                shownOnPhones ? 'inline-flex' : 'hidden md:inline-flex',
              )}
            >
              {i === last - 1 ? (
                <Icon name="caret-back" size="sm" className="text-ink-faint md:hidden" />
              ) : null}
              {i < last && item.href ? (
                <a
                  href={item.href}
                  className="inline-flex min-h-target items-center text-ink-muted transition-colors hover:text-brand-strong"
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current={i === last ? 'page' : undefined} className="font-semibold">
                  {item.label}
                </span>
              )}
              {i < last ? (
                <Icon name="caret-forward" size="sm" className="text-ink-faint max-md:hidden" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type PageItem = number | 'gap';

/** The page to mark as current: a whole page in 1..total; NaN or a fraction from `?page=` is safe. */
function clampPage(current: number, total: number): number {
  return Math.min(Math.max(1, Math.trunc(current) || 1), total);
}

/**
 * Pages to show: all up to seven, else the first, the last and the current with its neighbours,
 * with a gap where pages are skipped. Near either end five pages stay, so a gap always hides at
 * least two pages and the list keeps its width.
 */
export function pageItems(current: number, total: number): PageItem[] {
  if (!Number.isInteger(total) || total < 1) return [];
  const page = clampPage(current, total);
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  if (page <= 4) for (let n = 2; n <= 5; n++) keep.add(n);
  if (page >= total - 3) for (let n = total - 4; n < total; n++) keep.add(n);
  const sorted = [...keep].sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) items.push('gap');
    items.push(n);
  });
  return items;
}

const ITEM =
  'relative inline-grid min-w-target place-items-center rounded-pill px-2 h-target text-small font-medium';

/**
 * Pagination (DESIGN.md 3.27): Persian digits, the current page in brand-strong 700 with the
 * diamond under it. In RTL «صفحهٔ قبل» sits at the start and points right (D-2); a missing
 * neighbour is an inert, hidden-from-assistive-tech placeholder instead of a dead link (D-3).
 */
export function Pagination(props: {
  current: number;
  total: number;
  href: (page: number) => string;
  className?: string;
}) {
  const items = pageItems(props.current, props.total);
  if (items.length < 2) return null;
  const page = clampPage(props.current, props.total);
  // Seven 44 px items fit a 358 px phone row; with more, phones show «صفحهٔ ۵ از ۱۲» between
  // the arrows instead of the numbers.
  const compact = items.length > 5;
  const wide = compact ? 'max-sm:hidden' : undefined;
  const step = (to: number, label: string, icon: 'caret-back' | 'caret-forward', rel: string) =>
    to >= 1 && to <= props.total ? (
      <a
        href={props.href(to)}
        rel={rel}
        aria-label={label}
        className={cx(ITEM, 'text-ink transition-colors hover:bg-brand-soft')}
      >
        <Icon name={icon} size="sm" />
      </a>
    ) : (
      <span aria-hidden="true" className={cx(ITEM, 'opacity-40')}>
        <Icon name={icon} size="sm" />
      </span>
    );
  return (
    <nav aria-label={t('ui.pagination.label')} className={props.className}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>{step(page - 1, t('ui.pagination.prev'), 'caret-back', 'prev')}</li>
        {items.map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className={cx(ITEM, 'text-ink-muted', wide)}>
              …
            </li>
          ) : (
            <li key={item} className={wide}>
              <a
                href={props.href(item)}
                aria-label={`${t('ui.pagination.page')} ${toPersianDigits(String(item))}`}
                aria-current={item === page ? 'page' : undefined}
                className={cx(
                  ITEM,
                  'transition-colors hover:bg-brand-soft',
                  item === page
                    ? "font-bold text-brand-strong after:absolute after:bottom-[2px] after:size-[6px] after:rotate-45 after:bg-brand after:content-['']"
                    : 'text-ink',
                )}
              >
                {toPersianDigits(String(item))}
              </a>
            </li>
          ),
        )}
        {compact ? (
          <li aria-current="page" className="px-2 text-small font-medium text-ink sm:hidden">
            {`${t('ui.pagination.page')} ${toPersianDigits(String(page))} ${t('ui.pagination.of')} ${toPersianDigits(String(props.total))}`}
          </li>
        ) : null}
        <li>{step(page + 1, t('ui.pagination.next'), 'caret-forward', 'next')}</li>
      </ul>
    </nav>
  );
}
