'use client';

import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui';
import { reduceFieldsToValues } from 'payload/shared';

import {
  codePoints,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  effectiveTitle,
  type SuffixKey,
  SUFFIXES,
  titleState,
  topicOf,
} from '@/fields/validators';
import { editorialText } from '@/i18n/fa-editorial';
import { buildPath, type PathCollection } from '@/lib/paths';
import { toPersianDigits } from '@/lib/persianText';

import styles from './editorial.module.css';

const TITLE_STATE = {
  long: 'editorial.serp.titleLong',
  short: 'editorial.serp.titleShort',
  ok: 'editorial.serp.titleOk',
} as const;

/**
 * H11, C24: the Google result while the editor types: the effective title with the suffix, the
 * Persian path, the description, code-point counts and the length state. Same rules as V-TITLE
 * and V-DESC; the suffix is the default text, which has the length of the live one.
 */
export function SerpPreview({ topic, suffix }: { topic: string[]; suffix: SuffixKey }) {
  const [fields] = useAllFormFields();
  const { collectionSlug } = useDocumentInfo();
  const data = reduceFieldsToValues(fields, true) as Record<string, unknown>;
  const seo = (data.seo ?? {}) as { title?: string | null; description?: string | null };
  const title = effectiveTitle(seo.title, topicOf(topic, data), SUFFIXES[suffix]);
  const titleLength = codePoints(title);
  const description = seo.description?.trim() ?? '';
  const descriptionLength = codePoints(description);
  const path = collectionSlug
    ? buildPath(collectionSlug as PathCollection, {
        slug: typeof data.slug === 'string' ? data.slug : null,
        key: typeof data.key === 'string' ? data.key : null,
      })
    : null;
  const descriptionKey = !description
    ? 'editorial.serp.descriptionEmpty'
    : descriptionLength < DESCRIPTION_MIN || descriptionLength > DESCRIPTION_MAX
      ? 'editorial.serp.descriptionOut'
      : 'editorial.serp.descriptionOk';
  const state = titleState(titleLength);
  return (
    <section className={styles.panel} aria-labelledby="serp-preview-heading">
      <h3 className={styles.heading} id="serp-preview-heading">
        {editorialText('editorial.serp.heading')}
      </h3>
      <div className={styles.serp}>
        <span className={styles.path}>{path ?? editorialText('editorial.serp.noPath')}</span>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </div>
      <p className={styles.meter} data-state={state}>
        <span>
          {editorialText('editorial.serp.titleCount', {
            count: toPersianDigits(String(titleLength)),
          })}
        </span>
        {' · '}
        <span>{editorialText(TITLE_STATE[state])}</span>
      </p>
      <p
        className={styles.meter}
        data-state={descriptionKey === 'editorial.serp.descriptionOk' ? 'ok' : 'short'}
      >
        <span>
          {editorialText('editorial.serp.descriptionCount', {
            count: toPersianDigits(String(descriptionLength)),
          })}
        </span>
        {' · '}
        <span>{editorialText(descriptionKey)}</span>
      </p>
    </section>
  );
}
