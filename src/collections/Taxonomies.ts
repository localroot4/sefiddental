import type { CollectionConfig } from 'payload';
import { text } from 'payload/shared';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import {
  jalaliUpdatedAt,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  withRules,
} from '@/fields/factories';
import { categoryTermRule } from '@/fields/validators';
import { contentHooks } from '@/hooks/compose';

/** spec-data 2.6 and 2.7: article categories and tags share one shape; no drafts. */

const shared = {
  admin: { group: 'محتوا', useAsTitle: 'title', defaultColumns: ['title', 'slug', 'updatedAt'] },
  defaultSort: 'title',
  versions: true,
  trash: true,
} satisfies Partial<CollectionConfig>;

const description = proseTextarea('description', 'توضیح', {
  maxLength: 300,
  description: 'توضیح کوتاه بالای صفحهٔ فهرست.',
});

export const ArticleCategories: CollectionConfig = {
  slug: 'article-categories',
  labels: { singular: 'دستهٔ مقاله', plural: 'دسته‌های مقاله' },
  ...shared,
  admin: { ...shared.admin, hidden: hiddenForEditors },
  ...taxonomyAccess(),
  hooks: contentHooks('article-categories', {
    path: 'article-categories',
    normalize: { prose: ['title', 'description', 'seo.title', 'seo.description'] },
  }),
  fields: [
    {
      ...proseText('title', 'نام دسته', {
        required: true,
        maxLength: 60,
        description:
          'نام دسته. نباید با نام یک خدمت یکی باشد (مثلاً «ایمپلنت» نه، «جایگزینی دندان» بله).',
      }),
      validate: withRules(text, async (value, { req, event }) => {
        if (typeof value !== 'string' || event !== 'submit') return true;
        const services = await req.payload.find({
          collection: 'services',
          depth: 0,
          pagination: false,
          select: { navLabel: true, h1: true, searchTerms: true },
          req,
        });
        const terms = services.docs.flatMap((s) =>
          [s.navLabel, s.h1, s.searchTerms?.[0]].filter((t): t is string => typeof t === 'string'),
        );
        return categoryTermRule(value, terms);
      }),
    },
    slugField({ source: 'title', description: 'بخش آخر نشانی.' }),
    description,
    seoGroup({ suffix: 'articleCategory', topic: ['{title}'] }),
    jalaliUpdatedAt,
  ],
};

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'برچسب', plural: 'برچسب‌ها' },
  ...shared,
  admin: {
    ...shared.admin,
    description:
      'برچسب‌ها مقاله‌های هم‌موضوع را کنار هم می‌آورند. صفحهٔ برچسب در گوگل نمایه نمی‌شود؛ برچسب تازه فقط وقتی بسازید که دست‌کم دو مقاله آن را دارند.',
  },
  ...taxonomyAccess({ editorsWrite: true }),
  hooks: contentHooks('tags', {
    path: 'tags',
    normalize: { prose: ['title', 'description', 'seo.title', 'seo.description'] },
  }),
  fields: [
    proseText('title', 'نام برچسب', { required: true, maxLength: 60, description: 'نام برچسب.' }),
    slugField({ source: 'title', description: 'بخش آخر نشانی.' }),
    description,
    seoGroup({ topic: ['{title}'] }),
    jalaliUpdatedAt,
  ],
};
