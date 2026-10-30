import { t, type MessageKey } from '@/i18n/fa';
import { PAGE_PATHS, type PageKey } from '@/lib/paths';

export interface ChromeLink {
  href: string;
  label: string;
}

const LABELS = {
  'services-hub': 'nav.allServices',
  'dentists-hub': 'nav.dentists',
  pricing: 'nav.pricing',
  address: 'nav.address',
  'guide-hub': 'nav.guideHub',
  'guide-first-visit': 'nav.firstVisit',
  articles: 'nav.articles',
  about: 'nav.about',
  emergency: 'urgent.label',
  privacy: 'nav.privacy',
} as const satisfies Partial<Record<PageKey, MessageKey>>;

/** A page link of the chrome: the path from PAGE_PATHS, the one label of its intent. */
export function pageLink(key: keyof typeof LABELS, href = PAGE_PATHS[key]): ChromeLink {
  return { href, label: t(LABELS[key]) };
}
