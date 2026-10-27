import { CategoryTile, TileGrid } from '@/components/ui/Cards';
import { MediaPlaceholder } from '@/components/ui/Media';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import type { CatalogCategory } from '@/lib/data/catalog';
import { PAGE_PATHS } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';

import { HomeSection, type Copy } from './HomeSection';

/** Scene 3 (family C): one tile per category, the first (cosmetic) large; standalone ones link to their service. */
export function ServicesSection(props: { tree: CatalogCategory[]; copy: Copy }) {
  const categories = props.tree.filter((c) => c.path);
  if (categories.length === 0) return null;
  return (
    <HomeSection
      scene="services"
      section="services"
      family="C"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS['services-hub']} className="-ms-2">
          {t('home.services.all')}
        </TextLink>
      }
    >
      <TileGrid>
        {categories.map((category, i) => (
          <CategoryTile
            key={category.key}
            href={category.path as string}
            title={category.title}
            accent={category.accent}
            icon={category.icon}
            list={
              category.standalone
                ? (category.summary ?? category.services[0]?.summary ?? undefined)
                : category.services.map((s) => s.navLabel).join('، ')
            }
            count={
              category.standalone
                ? undefined
                : `${formatNumberFa(category.services.length)} ${t('home.services.unit')}`
            }
            featured={i === 0}
            media={i === 0 ? <MediaPlaceholder caption={t('home.services.photo')} /> : undefined}
          />
        ))}
      </TileGrid>
    </HomeSection>
  );
}
