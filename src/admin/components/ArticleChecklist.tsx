'use client';

import { useAllFormFields } from '@payloadcms/ui';
import { reduceFieldsToValues } from 'payload/shared';
import { useEffect, useState } from 'react';

import {
  type ArticleLookups,
  articleChecks,
  type InternalLink,
  internalLinks,
  LINK_TITLE_FIELD,
  linkTarget,
} from '@/fields/validators';
import { type EditorialMessageKey, editorialText } from '@/i18n/fa-editorial';
import { toPersianDigits } from '@/lib/persianText';

import styles from './editorial.module.css';

/** C26: the writing steps of the editorial guide that no rule can check. */
const MANUAL: EditorialMessageKey[] = [
  'editorial.manual.intent',
  'editorial.manual.question',
  'editorial.manual.plain',
  'editorial.manual.source',
  'editorial.manual.cta',
  'editorial.manual.image',
];

type Doc = Record<string, unknown>;

const idOf = (value: unknown): number | string | null => {
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value;
  return typeof id === 'number' || typeof id === 'string' ? id : null;
};

async function getJson(url: string, signal: AbortSignal): Promise<Doc | null> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  return response.ok ? ((await response.json()) as Doc) : null;
}

type Ids = [cover: Id, reviewer: Id, primary: Id, links: InternalLink[]];
type Id = number | string | null;

/** The documents the rules read beyond the form; the lookups run again only when they change. */
const idsOf = (data: Doc): Ids => [
  idOf(data.cover),
  idOf(data.reviewer),
  idOf(data.primaryService),
  internalLinks(data.body),
];

/** What the rules need beyond the form, read through the REST API with the staff session. */
async function lookup(
  [cover, reviewer, primary, links]: Ids,
  signal: AbortSignal,
): Promise<ArticleLookups> {
  const lookups: ArticleLookups = { primary: null };
  if (cover !== null) {
    const media = await getJson(`/api/media/${cover}?depth=0&select[alt]=true`, signal);
    lookups.coverAlt = typeof media?.alt === 'string' ? media.alt : null;
  }
  if (reviewer !== null) {
    const doctor = await getJson(`/api/doctors/${reviewer}?depth=0&select[_status]=true`, signal);
    lookups.reviewerPublished = doctor?._status === 'published';
  }
  const found = new Map<string, Doc>();
  for (const collection of new Set(links.map((l) => l.relationTo))) {
    const field = LINK_TITLE_FIELD[collection];
    if (!field) continue;
    const ids = links.filter((l) => l.relationTo === collection).map((l) => l.id);
    const key = collection === 'pages' ? '&select[key]=true' : '';
    const list = await getJson(
      `/api/${collection}?where[id][in]=${ids.join(',')}&depth=0&limit=0&select[_status]=true&select[${field}]=true${key}`,
      signal,
    );
    for (const doc of (list?.docs as Doc[] | undefined) ?? []) {
      found.set(`${collection}:${String(doc.id)}`, doc);
    }
  }
  lookups.targets = links.map((link) =>
    linkTarget(link, found.get(`${link.relationTo}:${link.id}`)),
  );
  if (primary !== null) {
    const linked = lookups.targets.find(
      (t) => t.relationTo === 'services' && String(t.id) === String(primary),
    );
    const service = linked
      ? null
      : await getJson(`/api/services/${primary}?depth=0&select[navLabel]=true`, signal);
    lookups.primary = { id: primary, title: linked?.title ?? String(service?.navLabel ?? '') };
  }
  return lookups;
}

/**
 * H11, C26: the article sidebar runs the publish rules on the form as the editor types (Payload
 * shows field errors only after a submit) and lists the writing steps. Lines that need other
 * documents (cover alt, link targets, reviewer) wait 400 ms after the last change and stay
 * «در حال بررسی» until the API answers. The publish gate on the server stays the authority.
 */
export function ArticleChecklist() {
  const [fields] = useAllFormFields();
  const data = reduceFieldsToValues(fields, true) as Doc;
  const key = JSON.stringify(idsOf(data));
  const [loaded, setLoaded] = useState<{ key: string; lookups: ArticleLookups }>({
    key: '',
    lookups: {},
  });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      lookup(JSON.parse(key) as Ids, controller.signal)
        .then((lookups) => setLoaded({ key, lookups }))
        // A failed lookup leaves its lines pending; the publish gate still checks them.
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  const checks = articleChecks(data, loaded.key === key ? loaded.lookups : {});
  const done = checks.filter((c) => c.result === true).length;
  return (
    <section className={styles.panel} aria-labelledby="article-checklist-heading">
      <h3 className={styles.heading} id="article-checklist-heading">
        {editorialText('editorial.checklist.heading')}
      </h3>
      <p className={styles.lead}>{editorialText('editorial.checklist.lead')}</p>
      <p className={styles.count} aria-live="polite">
        {editorialText('editorial.checklist.count', {
          done: toPersianDigits(String(done)),
          total: toPersianDigits(String(checks.length)),
        })}
      </p>
      <ul className={styles.list} aria-labelledby="article-checklist-heading">
        {checks.map((check) => {
          const state =
            check.result === true ? 'pass' : check.result === 'pending' ? 'pending' : 'fail';
          return (
            <li className={styles.item} data-state={state} key={check.id}>
              <span className={styles.label}>{check.label}</span>
              <span className={styles.result}>
                {check.result === true
                  ? editorialText('editorial.checklist.pass')
                  : check.result === 'pending'
                    ? editorialText('editorial.checklist.pending')
                    : check.result}
              </span>
              {check.warning ? <span className={styles.warning}>{check.warning}</span> : null}
            </li>
          );
        })}
      </ul>
      <h4 className={styles.heading} id="article-manual-heading">
        {editorialText('editorial.checklist.manualHeading')}
      </h4>
      <ol className={styles.manual} aria-labelledby="article-manual-heading">
        {MANUAL.map((step) => (
          <li key={step}>{editorialText(step)}</li>
        ))}
      </ol>
    </section>
  );
}
