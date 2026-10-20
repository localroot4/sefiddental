import { getVisibleEntities } from '@payloadcms/ui/shared';
import type { PayloadRequest, ServerProps } from 'payload';

import panel from '@/admin/bookings/bookings.module.css';
import { isVerifiedStaff } from '@/admin/bookings/counts';
import { loadSeoHealth, SEO_RULES, type SeoHealthReport } from '@/admin/seoHealth';
import { widgetRead } from '@/admin/widgets';
import { adminText } from '@/i18n/fa-admin';
import { formatNumberFa } from '@/lib/persianText';

import styles from './dashboard.module.css';

const SHOWN = 3;

/** The widget body: one row per broken rule and the first documents to fix; null is a failed read. */
export function SeoHealthBody({ report }: { report: SeoHealthReport | null }) {
  const rules = report ? SEO_RULES.filter((rule) => report[rule].length > 0) : [];
  return (
    <section aria-labelledby="seo-health" className={panel.today}>
      <h2 id="seo-health" className={panel.todayHeading}>
        {adminText('admin.seo.heading')}
      </h2>
      <p className={styles.lead}>{adminText('admin.seo.lead')}</p>
      {report === null ? <p className={styles.empty}>{adminText('admin.unknown')}</p> : null}
      {report && rules.length === 0 ? (
        <p className={styles.empty}>{adminText('admin.seo.allGood')}</p>
      ) : null}
      {rules.map((rule) => {
        const items = report?.[rule] ?? [];
        return (
          <div key={rule}>
            <h3 className={styles.subheading}>
              {adminText(`admin.seo.${rule}`)}{' '}
              <span className={styles.count}>{formatNumberFa(items.length)}</span>
            </h3>
            <ul className={styles.list}>
              {items.slice(0, SHOWN).map((item) => (
                <li key={`${item.collection}:${item.id}`} className={styles.item}>
                  <a className={styles.link} href={item.href}>
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
            {items.length > SHOWN ? (
              <p className={styles.meta}>
                {adminText('admin.seo.more', { n: formatNumberFa(items.length - SHOWN) })}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/**
 * `beforeDashboard`: SEO health for TOTP-verified staff over the collections they see (editors:
 * articles only). Reads with access overridden after that check (seoHealth.ts).
 */
export async function SeoHealth({ payload, user }: ServerProps) {
  if (!(await isVerifiedStaff(payload, user))) return null;
  // DefaultDashboard passes no visibleEntities, so work them out as Payload's navigation does.
  const report = await widgetRead('seo_health', () =>
    loadSeoHealth(
      payload,
      getVisibleEntities({ req: { payload, user } as PayloadRequest }).collections,
    ),
  );
  return <SeoHealthBody report={report} />;
}
