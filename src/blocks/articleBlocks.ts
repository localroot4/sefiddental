import type { Block } from 'payload';
import { array, text } from 'payload/shared';

import { proseText, proseTextarea, withRules } from '@/fields/factories';
import { proseRule, tableCellsRule, tableRowsRule } from '@/fields/validators';

import { CalloutBlock } from './index';

/**
 * H8, C20, C21: the blocks of the article body (Lexical BlocksFeature `blocks`, never
 * `inlineBlocks`, so a table or a figure never sits inside a paragraph). They live in the body
 * JSON: no table. Contract (plan 2.1): callout {tone, text}, table {caption, head[2-4],
 * rows[{cells}]}, video {video, poster, summary}. TEMPLATES renders them in RichBody.
 */

export const TableBlock: Block = {
  slug: 'table',
  labels: { singular: 'جدول', plural: 'جدول‌ها' },
  fields: [
    proseText('caption', 'عنوان جدول', {
      required: true,
      maxLength: 120,
      description: 'عنوان کوتاه جدول؛ بالای جدول دیده و برای صفحه‌خوان خوانده می‌شود.',
    }),
    proseText('head', 'سرستون‌ها', {
      required: true,
      hasMany: true,
      minRows: 2,
      maxRows: 4,
      description: 'دو تا چهار سرستون، هر کدام در یک ردیف.',
    }),
    {
      name: 'rows',
      type: 'array',
      label: 'ردیف‌ها',
      labels: { singular: 'ردیف', plural: 'ردیف‌ها' },
      required: true,
      minRows: 1,
      maxRows: 20,
      validate: withRules(array, (value, { siblingData }) =>
        tableRowsRule(value, siblingData.head),
      ),
      admin: { description: 'هر ردیف به تعداد سرستون‌ها خانه دارد.' },
      fields: [
        {
          ...proseText('cells', 'خانه‌ها', {
            required: true,
            hasMany: true,
            maxRows: 4,
            description: 'خانه‌های این ردیف، به ترتیب سرستون‌ها.',
          }),
          validate: withRules(text, (value) => proseRule(value), tableCellsRule),
        },
      ],
    },
  ],
};

export const VideoBlock: Block = {
  slug: 'video',
  labels: { singular: 'ویدیو', plural: 'ویدیوها' },
  fields: [
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      label: 'فایل ویدیو',
      required: true,
      filterOptions: { mimeType: { contains: 'video' } },
      admin: { description: 'فایل ویدیو (MP4 یا WebM) از کتابخانهٔ رسانه.' },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      label: 'تصویر پیش‌نمایش',
      required: true,
      filterOptions: { mimeType: { contains: 'image' } },
      admin: { description: 'تصویری که به‌جای ویدیو دیده می‌شود.' },
    },
    proseTextarea('summary', 'خلاصهٔ ویدیو', {
      required: true,
      maxLength: 600,
      description:
        'آنچه در ویدیو گفته و نشان داده می‌شود، به فارسی. تا زیرنویس آماده شود، همین متن جای ویدیو را می‌گیرد.',
    }),
  ],
};

export const ARTICLE_BLOCKS: Block[] = [CalloutBlock, TableBlock, VideoBlock];
