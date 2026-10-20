import { ArticleMeta } from '@/components/ui/Article';
import { ButtonLink } from '@/components/ui/Button';
import { ServiceCard } from '@/components/ui/Cards';
import { cx } from '@/components/ui/cx';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { ltr } from '@/components/ui/ltr';
import { MediaFrame } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { ARTICLES_MESSAGES as A } from '@/i18n/fa-articles';
import type { ArticleCard } from '@/lib/data/content';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import type { ArticleCategory, Service } from '@/payload-types';

import { mediaOf } from './view';

/*
 * The presentational parts of the article templates (T-articles, T-article): no data reads, so
 * they render in the DOM tests. The templates (ArticlesHub.tsx, Article.tsx) read and compose.
 */

export const articlePath = (article: { slug: string }): string =>
  buildPath('articles', article) as string;

// Family C with exactly as many cells as cards (templates 1.7, FILL_GRID of the services
// sections): a short last row grows to fill it. Kept here so the parts load without that module.
const FILL_GRID =
  'flex flex-wrap gap-3 [&>li]:grid [&>li]:grow [&>li]:basis-full md:[&>li]:basis-[calc(50%-var(--space-3))] lg:[&>li]:basis-[calc(33.333%-var(--space-3))]';

/** Article cards (family C), newest first, or the empty state while none is published. */
export function ArticleList(props: { articles: ArticleCard[]; headingLevel?: 'h2' | 'h3' }) {
  if (props.articles.length === 0) {
    return (
      <EmptyState
        action={
          <ButtonLink variant="secondary" href={PAGE_PATHS['services-hub']}>
            {t('pages.allServices')}
          </ButtonLink>
        }
      >
        {A['articles.empty']}
      </EmptyState>
    );
  }
  return (
    <ul className={FILL_GRID}>
      {props.articles.map((article) => {
        const cover = mediaOf(article.cover);
        return (
          <li key={article.id}>
            <ServiceCard
              href={articlePath(article)}
              title={ltr(article.title)}
              line={ltr(article.excerpt)}
              headingLevel={props.headingLevel}
              media={
                cover ? (
                  <Picture
                    media={cover}
                    sizes="(min-width: 1024px) 26rem, (min-width: 744px) 50vw, 100vw"
                  />
                ) : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The newest article on page 1 of the hub (T-articles family A): the cover, the only eager image
 * of the page (its LCP), beside the title, the excerpt and the date; the whole card is the link.
 */
export function FeaturedArticle(props: { article: ArticleCard }) {
  const { article } = props;
  const cover = mediaOf(article.cover);
  return (
    <article
      data-featured=""
      className="relative grid gap-6 rounded-card border border-line bg-surface-raised p-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-8 md:p-6"
    >
      {cover ? (
        <MediaFrame ratio="16:9">
          <Picture
            media={cover}
            priority
            sizes="(min-width: 1280px) 44rem, (min-width: 744px) 56vw, 100vw"
          />
        </MediaFrame>
      ) : null}
      <div className="grid content-start gap-3">
        <p className="text-small font-semibold text-brand-strong">{A['articles.featured']}</p>
        <h2 className="font-display text-display-2 font-bold">
          <a
            href={articlePath(article)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {ltr(article.title)}
          </a>
        </h2>
        <p className="max-w-measure text-body-lg text-ink-muted">{ltr(article.excerpt)}</p>
        <ArticleMeta
          updatedAt={article.contentUpdatedAt ?? article.publishedAt}
          readingMinutes={article.readingTime}
        />
      </div>
    </article>
  );
}

const CHIP =
  'inline-flex min-h-target items-center rounded-pill border px-4 text-small font-medium transition-colors';

/**
 * The category chips of the article lists: «همه» (the hub) and every category with a published
 * article; the page's own chip is marked current (DESIGN.md chips: brand-soft fill, brand border).
 */
export function CategoryChips(props: {
  categories: Array<Pick<ArticleCategory, 'id' | 'title' | 'slug'>>;
  current?: number | 'all';
}) {
  const chips = [
    { id: 'all' as const, label: A['articles.allCategories'], href: PAGE_PATHS.articles },
    ...props.categories.map((category) => ({
      id: category.id,
      label: category.title,
      href: buildPath('article-categories', category) as string,
    })),
  ];
  return (
    <nav aria-label={A['articles.categories']}>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const current = chip.id === props.current;
          return (
            <li key={chip.id}>
              <a
                href={chip.href}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  CHIP,
                  current
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'border-line text-ink hover:bg-brand-soft',
                )}
              >
                {chip.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** H22: Telegram and WhatsApp share links as plain anchors (no script, no clinic number). */
export function ShareLinks(props: { url: string; title: string }) {
  const enc = encodeURIComponent;
  const links = [
    {
      icon: 'telegram' as const,
      label: A['articles.share.telegram'],
      href: `https://t.me/share/url?url=${enc(props.url)}&text=${enc(props.title)}`,
    },
    {
      icon: 'whatsapp' as const,
      label: A['articles.share.whatsapp'],
      href: `https://wa.me/?text=${enc(`${props.title} ${props.url}`)}`,
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p id="share-title" className="text-small font-semibold">
        {A['articles.share']}
      </p>
      <ul aria-labelledby="share-title" className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.icon}>
            <a
              href={link.href}
              className={cx(CHIP, 'gap-2 border-line text-ink hover:bg-brand-soft')}
            >
              <Icon name={link.icon} size="sm" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The post's one CTA (H21, conversion.md T-article): the primary service box with «رزرو نوبت»
 * for that service; an article without a service gives the pricing page and the same booking
 * link. Never a dialog on a post (no island).
 */
export function ArticleCta(props: {
  service: Pick<Service, 'key' | 'navLabel' | 'slug' | 'summary'> | null;
}) {
  const service = props.service;
  return (
    <div className="grid gap-6 rounded-card border border-line bg-surface-raised p-6 md:flex md:items-center md:justify-between md:gap-8">
      <div className="grid max-w-measure gap-2">
        <h2 id="cta-title" className="text-heading font-semibold">
          {service ? service.navLabel : A['articles.cta.pricingTitle']}
        </h2>
        {service?.summary || !service ? (
          <p className="text-small text-ink-muted">
            {service?.summary ? ltr(service.summary) : A['articles.cta.pricingLine']}
          </p>
        ) : null}
        <TextLink
          standalone
          href={service ? (buildPath('services', service) as string) : PAGE_PATHS.pricing}
          className="-ms-2 justify-self-start"
        >
          {service
            ? A['articles.cta.about'].replaceAll('{name}', service.navLabel)
            : A['articles.cta.pricing']}
        </TextLink>
      </div>
      <ButtonLink
        size="lg"
        href={
          service
            ? `${PAGE_PATHS.booking}?service=${encodeURIComponent(service.key)}`
            : PAGE_PATHS.booking
        }
        track={{ event: 'booking_open', location: 'article', serviceKey: service?.key }}
        data-booking-cta=""
        className="justify-self-start"
      >
        {A['articles.cta.book']}
      </ButtonLink>
    </div>
  );
}
