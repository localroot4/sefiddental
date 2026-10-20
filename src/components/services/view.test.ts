import { describe, expect, it } from 'vitest';

import type { CatalogCategory } from '@/lib/data/catalog';
import type { Service } from '@/payload-types';
import { lexicalFrom } from '@/seed/transforms';

import {
  headingAnchors,
  paragraphs,
  priceFromFa,
  relatedHeading,
  relatedServices,
  serviceFacts,
  splitBody,
  whatsappHref,
} from './view';

type Body = NonNullable<Service['body']>;

const content = (text: string) =>
  ({ blockType: 'content', body: lexicalFrom(text) }) as unknown as Body[number];

describe('services view', () => {
  it('SE1 splitBody sends steps to section 5 and content and callouts to section 4 in order', () => {
    const steps = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ title: `${prefix}${i}`, text: 'متن' }));
    const body: Body = [
      content('## اول'),
      { blockType: 'steps', items: steps(5, 'الف') },
      { blockType: 'callout', tone: 'info', text: 'نکته' },
      { blockType: 'steps', items: steps(5, 'ب') },
      content('## دوم'),
    ];
    const { reading, steps: items } = splitBody(body);
    expect(reading.map((b) => b.blockType)).toEqual(['content', 'callout', 'content']);
    // Both steps blocks in order, capped at eight (docs/ia.md T-service 5).
    expect(items).toHaveLength(8);
    expect(items[0]?.title).toBe('الف0');
    expect(items[5]?.title).toBe('ب0');
    expect(splitBody(null)).toEqual({ reading: [], steps: [] });
  });

  it('SE2 paragraphs splits on blank lines and joins single line breaks', () => {
    expect(paragraphs('یک\nادامه\n\nدو\n  \nسه')).toEqual(['یک ادامه', 'دو', 'سه']);
    expect(paragraphs('  ')).toEqual([]);
    expect(paragraphs(null)).toEqual([]);
  });

  it('SE3 facts render from three filled facts, each with its label; the price in Persian digits', () => {
    expect(serviceFacts({ facts: { sessions: 'یک جلسه', recovery: 'همان روز' } })).toEqual([]);
    const facts = serviceFacts({
      facts: { sessions: 'یک جلسه', duration: ' ', anesthesia: 'موضعی', recovery: 'همان روز' },
      priceFrom: 2500000,
    });
    expect(facts.map((f) => f.caption)).toEqual(['تعداد جلسه', 'بی‌حسی', 'بهبود', 'هزینه']);
    expect(facts[3]?.value).toBe('از ۲٬۵۰۰٬۰۰۰ تومان');
    expect(priceFromFa(null)).toBeNull();
    expect(priceFromFa(0)).toBeNull();
  });

  it('SE4 related services: the editor list when set, else the same category, never itself', () => {
    const svc = (id: number) => ({
      id,
      key: `k${id}`,
      navLabel: `خدمت ${id}`,
      summary: null,
      path: `/خدمات/s${id}`,
      priority: 1,
    });
    const tree = [
      { id: 1, accent: 'cosmetic', icon: null, services: [svc(10), svc(11), svc(12), svc(13)] },
      { id: 2, accent: 'kids', icon: 'baby', services: [svc(20)] },
    ] as unknown as CatalogCategory[];
    // Editor order kept; 99 is unpublished (not in the catalogue) and 10 is the page itself.
    const chosen = relatedServices({ id: 10, categoryId: 1, relatedIds: [20, 99, 10, 12] }, tree);
    expect(chosen.map((s) => s.id)).toEqual([20, 12]);
    expect(chosen[0]?.accent).toBe('kids');
    const fallback = relatedServices({ id: 11, categoryId: 1, relatedIds: [] }, tree);
    expect(fallback.map((s) => s.id)).toEqual([10, 12, 13]);
    expect(relatedServices({ id: 20, categoryId: 2, relatedIds: [] }, tree)).toEqual([]);
  });

  it('SE5 WhatsApp links carry the service prefill (or the generic one), URL-encoded', () => {
    const href = whatsappHref('+989205451054', 'ترمیم دندان');
    expect(href.startsWith('https://wa.me/989205451054?text=')).toBe(true);
    const text = decodeURIComponent(href.split('text=')[1] ?? '');
    expect(text).toBe(
      'سلام، از صفحهٔ ترمیم دندان در سایت کلینیک سفید پیام می‌دهم. می‌خواهم دربارهٔ ترمیم دندان بیشتر بدانم.',
    );
    expect(decodeURIComponent(whatsappHref('+989205451054').split('text=')[1] ?? '')).toBe(
      'سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.',
    );
  });

  it('SE6 heading anchors: H2s only, Persian slugs, numbered repeats, never a reserved id', () => {
    const a = lexicalFrom('## سطح ترمیم\nمتن\n\n### زیر\n\n## مراقبت بعد');
    const b = lexicalFrom('## مراقبت بعد');
    const { ids, toc } = headingAnchors([a, b], ['سطح-ترمیم']);
    expect(toc).toEqual([
      { id: 'سطح-ترمیم-2', label: 'سطح ترمیم' },
      { id: 'مراقبت-بعد', label: 'مراقبت بعد' },
      { id: 'مراقبت-بعد-2', label: 'مراقبت بعد' },
    ]);
    expect(ids.get(a.root.children[0] as object)).toBe('سطح-ترمیم-2');
    expect(ids.size).toBe(3);
  });

  it('SE7 section 10 always renders (the pricing link); its heading names what it lists', () => {
    expect(relatedHeading(3, 2)).toBe('خدمات و مقاله‌های مرتبط');
    expect(relatedHeading(3, 0)).toBe('خدمات مرتبط');
    expect(relatedHeading(0, 1)).toBe('مقاله‌های مرتبط');
    expect(relatedHeading(0, 0)).toBe('هزینه و خدمات دیگر');
  });
});
