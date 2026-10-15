import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';
import { formatJalali } from '@/lib/jalali';
import { toPersianDigits } from '@/lib/persianText';

import { cx } from './cx';

/**
 * Table of contents (family K): desktop only, sticky under the header; no TOC on phones and
 * tablets (DESIGN.md section 6).
 */
export function Toc(props: { items: Array<{ id: string; label: ReactNode }>; className?: string }) {
  if (props.items.length < 2) return null;
  return (
    <nav
      aria-label={t('ui.article.toc')}
      className={cx(
        'hidden lg:sticky lg:top-[calc(var(--nav-h)+var(--space-4))] lg:block',
        props.className,
      )}
    >
      <p className="mb-2 text-small font-semibold">{t('ui.article.toc')}</p>
      <ol className="grid border-s border-line">
        {props.items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-target items-center ps-4 text-small text-ink-muted transition-colors hover:text-brand-strong"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Updated date and reading time («به‌روزرسانی: دوشنبه ۲۰ مهر ۱۴۰۵ · زمان مطالعه: ۴ دقیقه»), the
 * date in Jalali with a UTC `datetime`; then the medical reviewer line when there is one.
 */
export function ArticleMeta(props: {
  updatedAt?: string | Date | null;
  readingMinutes?: number | null;
  reviewer?: ReactNode;
  className?: string;
}) {
  const updated = props.updatedAt ? new Date(props.updatedAt) : null;
  const valid = updated && !Number.isNaN(updated.getTime()) ? updated : null;
  return (
    <div className={cx('grid content-start gap-1 text-caption text-ink-muted', props.className)}>
      {valid || props.readingMinutes ? (
        <p>
          {valid ? (
            <>
              {t('ui.article.updated')}{' '}
              <time dateTime={valid.toISOString()}>{formatJalali(valid, 'EEEE d MMMM yyyy')}</time>
            </>
          ) : null}
          {valid && props.readingMinutes ? ' · ' : null}
          {props.readingMinutes
            ? `${t('ui.article.readingTime')} ${toPersianDigits(String(props.readingMinutes))} ${t('ui.article.minutes')}`
            : null}
        </p>
      ) : null}
      {props.reviewer ? (
        <p>
          {t('ui.article.reviewedBy')}{' '}
          <span className="font-semibold text-ink">{props.reviewer}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sources list (copy-guidelines: every service page and article lists its sources), numbered in
 * Persian digits. Titles are often Latin, so each title is isolated.
 */
export function SourceList(props: {
  id?: string;
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  if (props.items.length === 0) return null;
  return (
    <section aria-labelledby={props.id} className={cx('grid content-start gap-3', props.className)}>
      <h2 id={props.id} className="text-heading font-semibold">
        {t('ui.article.sources')}
      </h2>
      <ol className="grid gap-2 ps-6 text-small text-ink-muted [list-style-type:persian]">
        {props.items.map((item, i) => (
          <li key={i}>
            <bdi>
              {item.href ? (
                <a
                  href={item.href}
                  rel="noopener"
                  className="break-words text-brand-strong underline decoration-line-strong underline-offset-[.22em]"
                >
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </bdi>
          </li>
        ))}
      </ol>
    </section>
  );
}
