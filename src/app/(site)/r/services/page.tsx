import type { Metadata } from 'next';

import { getHubPage } from '@/components/services/data';
import { HubTemplate } from '@/components/services/HubTemplate';
import { PAGE_PATHS } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// The services hub /خدمات: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route
// under a Persian folder in a production build; proxyRules routeRewrite). Renders per request.
export async function generateMetadata(): Promise<Metadata> {
  const [page, { seo }] = await Promise.all([getHubPage(), getSiteInputs()]);
  return buildMetadata(
    {
      path: PAGE_PATHS['services-hub'],
      title: page.title,
      // templates 1.4: the SEO image, else the hero photo, else the default.
      seo: pageSeoFrom({ ...page.seo, image: page.seo?.image ?? page.heroMedia }),
      kind: 'page',
    },
    seo,
  );
}

export default async function ServicesHubPage() {
  return <HubTemplate page={await getHubPage()} />;
}
