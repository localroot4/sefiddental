import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { Media } from '@/payload-types';

import { Alert } from './Alert';
import { ArticleMeta, SourceList, Toc } from './Article';
import { Badge, Tag } from './Badge';
import { CardRail, CategoryIcon, CategoryTile, DentistCard, ServiceCard } from './Cards';
import { DirectionsLinks, PhoneNumber } from './Contact';
import { Fact, FactsRow, FaqList, Quote, Steps } from './Content';
import { EmptyState, Loading, SkeletonCard, SuccessCheck, Toast } from './Feedback';
import { hoursBadgeLabels } from './Hours';
import { HoursBadge } from './HoursBadge';
import { heroTitleSize, PageHero, Section, SectionHeader } from './Layout';
import { MediaFrame, MediaPlaceholder } from './Media';
import { Picture } from './Picture';
import { TestimonialCard } from './Testimonial';
import { TierComparison } from './Tiers';

// mediaPath reads the environment; the media origin is not under test here.
vi.mock('@/lib/env', () => ({ readEnv: () => ({ mediaPublicOrigin: undefined }) }));

const media = (sizes: Media['sizes'], extra: Partial<Media> = {}): Media => ({
  id: 1,
  alt: 'اتاق درمان',
  url: '/api/media/file/a.jpg',
  width: 4000,
  height: 2667,
  updatedAt: '',
  createdAt: '',
  sizes,
  ...extra,
});

const size = (name: string, width: number, height: number) => ({
  url: `http://localhost:3000/api/media/file/${name}`,
  width,
  height,
});

const VIDEO = {
  src: '/v.mp4',
  title: 'ویدیوی بیمار',
  captions: { src: '/v.fa.vtt', srclang: 'fa', label: 'فارسی' },
} as const;

describe('ui components: content, media, cards', () => {
  it('UX1 no style attribute anywhere in server HTML (the public CSP blocks it)', () => {
    const html = renderToStaticMarkup(
      <>
        <Alert tone="danger" title="t">
          b
        </Alert>
        <Badge tone="warm">b</Badge>
        <Tag href="/x">t</Tag>
        <ServiceCard
          href="/x"
          title="t"
          accent="kids"
          facts={['a']}
          linkText="l"
          media={<MediaPlaceholder variant="card" caption="c" />}
        />
        <CategoryTile
          href="/x"
          title="t"
          accent="cosmetic"
          featured
          media={<MediaPlaceholder caption="c" />}
        />
        <DentistCard name="n" councilNumber="۱۲" councilLabel="l" media={<i />} href="/x" />
        <PhoneNumber e164="+982155101054" link standalone />
        <DirectionsLinks maps={{ neshanUrl: 'https://neshan.org/x' }} />
        <FactsRow facts={[{ value: 'v', caption: 'c' }]} />
        <FaqList items={[{ question: 'q', answer: 'a', open: true }]} />
        <Steps items={[{ title: 't', text: 'x' }]} />
        <Quote cite="c">q</Quote>
        <EmptyState action={<a href="/x">a</a>}>e</EmptyState>
        <Loading label="l">
          <SkeletonCard />
        </Loading>
        <SuccessCheck compact />
        <Toast open>t</Toast>
        <Section labelledBy="s">
          <SectionHeader id="s" title="t" lead="l" action={<a href="/x">a</a>} />
        </Section>
        <PageHero
          title="t"
          summary="s"
          actions={<a href="/x">a</a>}
          media={
            <MediaFrame ratio="hero">
              <MediaPlaceholder caption="c" />
            </MediaFrame>
          }
        />
        <TierComparison
          label="l"
          tiers={[{ key: 'a', name: 'n', rows: [{ term: 't', value: 'v' }] }]}
        />
        <TestimonialCard label="l" consent="c" video={VIDEO} />
        <ArticleMeta updatedAt="2026-10-12T08:00:00Z" readingMinutes={4} />
        <SourceList items={[{ label: 'NHS', href: 'https://www.nhs.uk' }]} />
        <Toc
          items={[
            { id: 'a', label: 'a' },
            { id: 'b', label: 'b' },
          ]}
        />
        <Picture
          media={media(
            { w640: size('a-640.webp', 640, 427) },
            { blurDataURL: 'data:image/webp;base64,AA' },
          )}
          sizes="100vw"
        />
      </>,
    );
    expect(html).not.toMatch(/\sstyle=/);
  });

  it('UM1 Picture: AVIF then WebP sources from Payload sizes, site-relative, lazy over the blur', () => {
    const html = renderToStaticMarkup(
      <Picture
        media={media(
          {
            w640: size('a-640.webp', 640, 427),
            w640Avif: size('a-640.avif', 640, 427),
            w1280: size('a-1280.webp', 1280, 853),
            w1280Avif: size('a-1280.avif', 1280, 853),
          },
          { blurDataURL: 'data:image/webp;base64,AA' },
        )}
        sizes="(min-width: 1024px) 40vw, 100vw"
      />,
    );
    expect(html.indexOf('type="image/avif"')).toBeLessThan(html.indexOf('type="image/webp"'));
    expect(html).toContain(
      'srcSet="/api/media/file/a-640.avif 640w, /api/media/file/a-1280.avif 1280w"',
    );
    expect(html).toContain('src="/api/media/file/a-1280.webp"');
    expect(html).toContain('width="1280" height="853"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="اتاق درمان"');
    expect(html).toMatch(/<img src="data:image\/webp;base64,AA" alt="" aria-hidden="true"/);
  });

  it('UM2 Picture priority: eager, fetchpriority high, no blur; portrait crop uses the 4:5 sizes', () => {
    const html = renderToStaticMarkup(
      <Picture
        priority
        crop="portrait"
        media={media(
          { p828: size('a-p828.webp', 828, 1035), w640: size('a-640.webp', 640, 427) },
          { blurDataURLPortrait: 'data:x' },
        )}
        sizes="100vw"
      />,
    );
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain('data:x');
    expect(html).toContain('a-p828.webp 828w');
    expect(html).not.toContain('a-640.webp');
  });

  it('UM3 Picture without sizes falls back to the original; without any URL renders nothing', () => {
    expect(renderToStaticMarkup(<Picture media={media(undefined)} sizes="100vw" />)).toContain(
      'src="/api/media/file/a.jpg"',
    );
    expect(
      renderToStaticMarkup(<Picture media={media(undefined, { url: null })} sizes="100vw" />),
    ).toBe('');
  });

  it('UM4 placeholders name the missing photo with the «جای عکس:» prefix in the exact ratio', () => {
    render(<MediaPlaceholder variant="standalone" ratio="4:5" caption="پرترهٔ پزشک" />);
    const text = screen.getByText('پرترهٔ پزشک', { exact: false });
    expect(text.textContent).toBe('جای عکس: پرترهٔ پزشک');
    expect(text.parentElement!.className).toContain('aspect-[4/5]');
  });

  it('UC1 empty content renders nothing: facts, FAQ, steps, tiers, sources, a short TOC', () => {
    const html = renderToStaticMarkup(
      <>
        <FactsRow facts={[]} />
        <FaqList items={[]} />
        <Steps items={[]} />
        <TierComparison label="l" tiers={[]} />
        <SourceList items={[]} />
        <Toc items={[{ id: 'a', label: 'a' }]} />
      </>,
    );
    expect(html).toBe('');
  });

  it('UC2 facts: a cell per fact (no empty cells), the start-side brand line, number variant', () => {
    const three = renderToStaticMarkup(
      <FactsRow facts={[{ value: 'a' }, { value: 'b' }, { value: 'c' }]} />,
    );
    expect(three).toContain('lg:grid-cols-3');
    expect(three.match(/<li/g)).toHaveLength(3);
    const fact = renderToStaticMarkup(<Fact value="۱۲" number />);
    expect(fact).toContain('border-s-2 border-brand');
    expect(fact).toContain('text-display-2');
  });

  it('UC3 alerts: danger is an alert, the other tones a status', () => {
    render(
      <>
        <Alert tone="danger" title="ارسال انجام نشد." />
        <Alert tone="info" title="درخواست شما قبلاً ثبت شده است." />
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('ارسال انجام نشد.');
    expect(screen.getByRole('status').textContent).toContain('درخواست شما قبلاً ثبت شده است.');
  });

  it('UC4 the article meta: Jalali date with a UTC datetime and Persian reading time', () => {
    const html = renderToStaticMarkup(
      <ArticleMeta updatedAt="2026-10-12T08:00:00Z" readingMinutes={4} reviewer="ن" />,
    );
    expect(html).toContain('<time dateTime="2026-10-12T08:00:00.000Z">دوشنبه ۲۰ مهر ۱۴۰۵</time>');
    expect(html).toContain('زمان مطالعه: ۴ دقیقه');
    expect(renderToStaticMarkup(<ArticleMeta updatedAt="not a date" />)).not.toContain('<time');
  });

  it('UK1 link cards: the title link is the one control and stretches over the card', () => {
    render(
      <ServiceCard
        href="/خدمات/لمینت-سرامیکی"
        title="لمینت سرامیکی"
        line="یک خط"
        linkText="هزینه و شرایط لمینت سرامیکی"
        accent="cosmetic"
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toBe('لمینت سرامیکی');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('لمینت سرامیکی');
  });

  it("UK1b the focus ring sits on the link's ::after over the card border box, never on the card (:has())", () => {
    const { container } = render(<ServiceCard href="/x" title="t" accent="cosmetic" />);
    const link = screen.getByRole('link').className.split(' ');
    for (const cls of [
      'after:absolute',
      'after:-inset-px', // the card's 1 px border: the ring follows the card's own box
      'after:rounded-card',
      'focus-visible:outline-none',
      'focus-visible:after:outline-2',
      'focus-visible:after:outline-offset-2',
      'focus-visible:after:outline-focus',
    ]) {
      expect(link).toContain(cls);
    }
    const card = container.querySelector('article')!.className;
    expect(card).not.toContain('has-');
    expect(card.split(' ')).toEqual(expect.arrayContaining(['border', 'rounded-card']));
  });

  it('UK1c a rail of one card takes the row up to 24rem; more cards peek (no :has())', () => {
    const card = (key: string) => <DentistCard key={key} name={key} media={<i />} />;
    const rail = (children: ReactNode) =>
      render(<CardRail label="r">{children}</CardRail>)
        .getAllByRole('region')
        .at(-1)!
        .className.split(' ');
    const one = rail([card('a')]);
    expect(one).toContain('auto-cols-[min(100%,24rem)]');
    expect(one).not.toContain('auto-cols-[min(84%,20rem)]');
    const two = rail([card('a'), card('b')]);
    expect(two).toContain('auto-cols-[min(84%,20rem)]');
    expect(two).not.toContain('auto-cols-[min(100%,24rem)]');
  });

  it('UK2 category icons: the allowlisted admin glyph or the accent default, colored by class', () => {
    const glyph = (icon?: string) =>
      renderToStaticMarkup(<CategoryIcon accent="kids" icon={icon} />).match(/#([a-z-]+)"/)?.[1];
    expect(glyph()).toBe('duo-baby');
    expect(glyph(' Tooth ')).toBe('duo-tooth');
    expect(glyph('../../etc/passwd')).toBe('duo-baby');
    expect(renderToStaticMarkup(<CategoryIcon accent="kids" />)).toContain('fill-cat-kids');
  });

  it('UK3 dentist card: council number as an LTR island, no link without a profile', () => {
    const { container } = render(
      <DentistCard
        name="ن"
        councilLabel="شمارهٔ نظام پزشکی:"
        councilNumber="۱۲۳۴۵"
        media={<i />}
      />,
    );
    expect(container.querySelector('bdi[dir="ltr"]')?.textContent).toBe('۱۲۳۴۵');
    expect(container.querySelector('a')).toBeNull();
  });

  it('UK4 tier comparison: a focusable named scroller; the selected tier is warm with its badge', () => {
    render(
      <TierComparison
        label="سطح‌های ترمیم"
        selectedKey="vip"
        selectedLabel="انتخاب‌شده"
        tiers={[
          { key: 'standard', name: 'معمولی', rows: [] },
          { key: 'vip', name: 'VIP', rows: [{ term: 'مواد', value: 'م' }] },
        ]}
      />,
    );
    const region = screen.getByRole('region', { name: 'سطح‌های ترمیم' });
    expect(region.getAttribute('tabindex')).toBe('0');
    const vip = screen.getByRole('heading', { name: 'VIP' }).closest('article')!;
    expect(vip.className).toContain('bg-warm-soft');
    expect(vip.textContent).toContain('انتخاب‌شده');
    expect(
      screen.getByRole('heading', { name: 'معمولی' }).closest('article')!.className,
    ).not.toContain('warm');
  });

  it('UK5 phone numbers: Persian digits in an LTR island, dialing E.164', () => {
    render(<PhoneNumber e164="+982155101054" link />);
    const link = screen.getByRole('link', { name: '۰۲۱ ۵۵۱۰ ۱۰۵۴' });
    expect(link.getAttribute('href')).toBe('tel:+982155101054');
    expect(link.getAttribute('dir')).toBe('ltr');
  });

  it('UK6 directions: only the links the clinic filled in, tracked; none hides the block', () => {
    render(
      <DirectionsLinks
        maps={{ neshanUrl: 'https://neshan.org/x', wazeUrl: null }}
        location="block"
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['نشان']);
    expect(links[0]!.getAttribute('data-track')).toBe('directions_click');
    expect(links[0]!.getAttribute('data-location')).toBe('block');
    expect(renderToStaticMarkup(<DirectionsLinks maps={null} />)).toBe('');
  });

  it('UK7 page hero: one H1; phones stack text, media, then actions', () => {
    const html = renderToStaticMarkup(
      <PageHero title="عنوان" actions={<a href="/x">a</a>} media={<i />} />,
    );
    const markup = html.replaceAll('&#x27;', "'");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("[grid-template-areas:'text'_'media'_'actions']");
    const compact = renderToStaticMarkup(<PageHero compact title="عنوان" media={<i />} />);
    expect(compact).toContain('text-display-2');
    expect(compact).not.toContain('grid-area:media');
  });

  it('UK7b page hero: a long H1 takes the hero size over the whole text column; the summary keeps the measure', () => {
    expect(heroTitleSize('ب'.repeat(34))).toBe('display-1');
    expect(heroTitleSize('ترمیم دندان در سه سطح: معمولی، VIP و CIP')).toBe('hero');
    const { container } = render(<PageHero title="عنوان" titleSize="hero" summary="خلاصه" />);
    const h1 = container.querySelector('h1')!;
    expect(h1.className).toContain('text-hero');
    expect(h1.className).not.toContain('text-display');
    expect(h1.parentElement!.className).not.toContain('max-w-measure');
    expect(container.querySelector('h1 ~ p')!.className).toContain('max-w-measure');
    const plain = render(<PageHero title="عنوان" />).container.querySelector('h1')!;
    expect(plain.className).toContain('text-display-1');
  });

  it('UK8 testimonial video: Persian captions on by default, streams only on play', () => {
    const { container } = render(<TestimonialCard label="l" consent="c" video={VIDEO} />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.getAttribute('aria-label')).toBe('ویدیوی بیمار');
    const track = video.querySelector('track')!;
    expect(track.getAttribute('kind')).toBe('captions');
    expect(track.hasAttribute('default')).toBe(true);
    expect(track.getAttribute('srclang')).toBe('fa');
    expect(track.getAttribute('src')).toBe('/v.fa.vtt');
    expect(track.getAttribute('label')).toBe('فارسی');
  });

  it('UK9 toast: the live region is always exposed; the panel hides and keeps its text', () => {
    const classes = (el: Element) => el.className.split(' ');
    const closed = render(<Toast open={false}>ذخیره شد</Toast>);
    const region = closed.getByRole('status');
    expect(classes(region)).not.toContain('invisible');
    const panel = region.firstElementChild!;
    expect(classes(panel)).toContain('invisible');
    // The last message stays rendered so the fade-out is not an empty box.
    expect(panel.textContent).toBe('ذخیره شد');
    closed.rerender(<Toast open>ذخیره شد</Toast>);
    expect(classes(panel)).toContain('visible');
    expect(classes(panel)).not.toContain('invisible');
  });

  it('UK10 island-safe components carry no icon or message code: glyphs arrive as nodes (F2)', () => {
    for (const file of ['CompareSlider.tsx', 'HoursBadge.tsx']) {
      const source = readFileSync(path.resolve('src/components/ui', file), 'utf8');
      expect(source, file).not.toMatch(/from '(\.\/Icon|\.\/icons|@\/i18n\/fa)'/);
    }
    const html = renderToStaticMarkup(
      <HoursBadge state="open" labels={hoursBadgeLabels()} icon={<svg data-glyph="clock" />} />,
    );
    expect(html).toContain('data-glyph="clock"');
  });
});
