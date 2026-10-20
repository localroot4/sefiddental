import { t, type MessageKey } from '@/i18n/fa';
import type { CatalogCategory, CatalogService } from '@/lib/data/catalog';
import { persianSlug } from '@/lib/persianSlug';
import { formatNumberFa } from '@/lib/persianText';
import type { Service } from '@/payload-types';

/*
 * Pure view helpers of the services templates (hub, category, service): what renders, in which
 * section, in which order. The templates stay markup; the decisions here are unit-tested.
 */

type Body = NonNullable<Service['body']>[number];
export type ReadingBlock = Extract<Body, { blockType: 'content' | 'callout' }>;
export type StepItem = { title: string; text: string };

// docs/ia.md T-service section 5 caps the steps at eight.
const MAX_STEPS = 8;

/**
 * The service body by section (wave 1 request R4): `steps` blocks feed section 5, `content` and
 * `callout` blocks section 4 in their stored order.
 */
export function splitBody(body: Service['body']): { reading: ReadingBlock[]; steps: StepItem[] } {
  const reading: ReadingBlock[] = [];
  const steps: StepItem[] = [];
  for (const block of body ?? []) {
    if (block.blockType === 'steps') {
      steps.push(...(block.items ?? []).map(({ title, text }) => ({ title, text })));
    } else {
      reading.push(block);
    }
  }
  return { reading, steps: steps.slice(0, MAX_STEPS) };
}

/** A plain-text field as paragraphs: blank lines split them, single line breaks join (R4). */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n[^\S\n]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// A fact row is family B: three to six facts (DESIGN.md 6); fewer hide the row (templates C14).
const MIN_FACTS = 3;

const FACT_KEYS = [
  ['sessions', 'services.fact.sessions'],
  ['duration', 'services.fact.duration'],
  ['anesthesia', 'services.fact.anesthesia'],
  ['recovery', 'services.fact.recovery'],
] as const satisfies ReadonlyArray<[keyof NonNullable<Service['facts']>, MessageKey]>;

/** «از ۲٬۵۰۰٬۰۰۰ تومان», or null without a price (brief decision 4: no price, no line). */
export function priceFromFa(toman: number | null | undefined): string | null {
  return typeof toman === 'number' && toman > 0
    ? `${t('services.priceFrom')} ${formatNumberFa(toman)} ${t('services.toman')}`
    : null;
}

/** The filled facts of a service, each with its label as the caption; none below three. */
export function serviceFacts(
  service: Pick<Service, 'facts' | 'priceFrom'>,
): Array<{ value: string; caption: string }> {
  const facts = FACT_KEYS.flatMap(([field, key]) => {
    const value = service.facts?.[field]?.trim();
    return value ? [{ value, caption: t(key) }] : [];
  });
  const price = priceFromFa(service.priceFrom);
  if (price) facts.push({ value: price, caption: t('services.fact.price') });
  return facts.length >= MIN_FACTS ? facts : [];
}

export type RelatedService = CatalogService &
  Pick<CatalogCategory, 'accent' | 'icon'> & { categoryId: number };

// docs/ia.md T-service section 10: up to three related services.
const MAX_RELATED = 3;

/**
 * Section 10 cards: the editor's related services that are published, in the editor's order, else
 * the same category's other services, money services first (templates C22).
 */
export function relatedServices(
  service: { id: number; categoryId: number | null; relatedIds: number[] },
  tree: CatalogCategory[],
): RelatedService[] {
  const all: RelatedService[] = tree.flatMap((category) =>
    category.services.map((item) => ({
      ...item,
      accent: category.accent,
      icon: category.icon,
      categoryId: category.id,
    })),
  );
  const chosen = service.relatedIds.flatMap((id) =>
    id === service.id ? [] : all.filter((item) => item.id === id),
  );
  const list = chosen.length
    ? chosen
    : all.filter((item) => item.categoryId === service.categoryId && item.id !== service.id);
  return list.slice(0, MAX_RELATED);
}

/**
 * Section 10's heading (docs/ia.md: related services and articles). The section always renders:
 * every service links the pricing page (ia.md section 5), with or without related items (H24).
 */
export function relatedHeading(services: number, articles: number): string {
  if (services && articles) return t('services.related.both');
  if (services) return t('services.related.heading');
  return articles ? t('services.related.articles') : t('services.related.none');
}

/** wa.me link with the prefill of conversion.md 8 (no personal data): the service's, else generic. */
export function whatsappHref(e164: string, navLabel?: string): string {
  const text = navLabel
    ? t('services.whatsappText').replaceAll('{name}', navLabel)
    : t('services.whatsappGeneric');
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

type LexicalNode = { type?: string; tag?: string; text?: string; children?: LexicalNode[] };
type LexicalRoot = { root: { children: LexicalNode[] } };

const textOf = (node: LexicalNode): string =>
  node.text ?? (node.children ?? []).map(textOf).join('');

/**
 * Ids for the H2s of the rich-text blocks and the in-page nav built from them (family K): a
 * Persian slug of the heading, numbered on a repeat, never one of the page's own anchors. The map
 * is keyed by node, so the renderer finds each heading's id without recomputing it.
 */
export function headingAnchors(
  bodies: LexicalRoot[],
  reserved: readonly string[] = [],
): { ids: Map<object, string>; toc: Array<{ id: string; label: string }> } {
  const ids = new Map<object, string>();
  const toc: Array<{ id: string; label: string }> = [];
  const used = new Set(reserved);
  for (const body of bodies) {
    for (const node of body.root.children) {
      if (node.type !== 'heading' || node.tag !== 'h2') continue;
      const label = textOf(node).trim();
      const base = persianSlug(label) || 'section';
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      ids.set(node, id);
      toc.push({ id, label });
    }
  }
  return { ids, toc };
}
