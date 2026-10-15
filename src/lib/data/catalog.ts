import type { ServiceCategory } from '@/payload-types';

import { SYSTEM_LINKS } from '@/i18n/fa';
import { log } from '@/lib/log/logger';
import { buildPath, PAGE_PATHS } from '@/lib/paths';

import { getPublished } from './published';

export interface CatalogService {
  id: number;
  key: string;
  navLabel: string;
  summary: string | null;
  path: string;
  priority: number;
}

export interface CatalogCategory {
  id: number;
  key: string;
  title: string;
  navLabel: string;
  summary: string | null;
  icon: string | null;
  accent: ServiceCategory['accent'];
  standalone: boolean;
  /** The category page; for a standalone category its service's page (null while unpublished). */
  path: string | null;
  services: CatalogService[];
}

export interface NavLink {
  key: string;
  label: string;
  path: string;
}

export interface NavGroup extends NavLink {
  /** The category title (the label is its navLabel). */
  title: string;
  items: NavLink[];
}

/** The services mega menu and drawer (docs/ia.md section 2). */
export interface NavTree {
  /** Categories with a page, by order, each with its services. */
  groups: NavGroup[];
  /** Services of the standalone categories («سایر خدمات»). */
  others: NavLink[];
}

const idOf = (value: number | { id: number } | null | undefined): number | null =>
  typeof value === 'object' && value !== null ? value.id : (value ?? null);

/**
 * Published categories by `order`, each with its published services, money services first
 * (`priority`, then `order`; docs/ia.md section 2). Two tagged reads (col:service-categories,
 * col:services); every listing of the catalogue reads it.
 */
export async function getServiceTree(): Promise<CatalogCategory[]> {
  const [categories, services] = await Promise.all([
    getPublished('service-categories', { sort: 'order', joins: false }),
    getPublished('services', { sort: ['priority', 'order'], joins: false }),
  ]);
  const items = services.flatMap((service) => {
    const path = buildPath('services', service);
    if (!path) return [];
    const { id, key, navLabel, priority } = service;
    const item: CatalogService = {
      id,
      key,
      navLabel,
      summary: service.summary ?? null,
      path,
      priority,
    };
    return [{ category: idOf(service.category), item }];
  });
  return categories.map((category) => {
    const own = items.filter((entry) => entry.category === category.id).map((entry) => entry.item);
    const standalone = Boolean(category.standalone);
    const target = idOf(category.standaloneService);
    return {
      id: category.id,
      key: category.key,
      title: category.title,
      navLabel: category.navLabel,
      summary: category.summary ?? null,
      icon: category.icon ?? null,
      accent: category.accent,
      standalone,
      path: standalone
        ? (items.find((entry) => entry.item.id === target)?.item.path ?? null)
        : buildPath('service-categories', category),
      services: own,
    };
  });
}

/** The nav tree of a catalogue: categories with a page as groups, standalone services apart. */
export function navTreeFrom(tree: CatalogCategory[]): NavTree {
  const link = ({ key, navLabel, path }: CatalogService): NavLink => ({
    key,
    label: navLabel,
    path,
  });
  return {
    groups: tree.flatMap((category) =>
      !category.standalone && category.path
        ? [
            {
              key: category.key,
              label: category.navLabel,
              title: category.title,
              path: category.path,
              items: category.services.map(link),
            },
          ]
        : [],
    ),
    others: tree.filter((category) => category.standalone).flatMap((c) => c.services.map(link)),
  };
}

/** With the database down: the category links of the system pages (SYSTEM_LINKS), no services. */
export const NAV_FALLBACK: NavTree = {
  groups: SYSTEM_LINKS.filter((link) => link.href !== PAGE_PATHS['services-hub']).map(
    ({ label, href }) => ({ key: href, label, title: label, path: href, items: [] }),
  ),
  others: [],
};

/**
 * The header and drawer nav. The shell also renders the 404 document, so a failed read answers
 * the fallback with one error line, never a throw (CC-7).
 */
export async function getNavTree(): Promise<NavTree> {
  try {
    return navTreeFrom(await getServiceTree());
  } catch (err) {
    log.error({ msg: 'nav_tree_unavailable', err });
    return NAV_FALLBACK;
  }
}
