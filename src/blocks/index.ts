import type { Block } from 'payload';
import { richText } from 'payload/shared';

import { faqsArray, proseText, proseTextarea, withRules } from '@/fields/factories';
import { richProseRule } from '@/fields/validators';

/** Page and service body blocks (spec-data 5.5). Slugs are camelCase (spec-data P15). */

export const ContentBlock: Block = {
  slug: 'content',
  labels: { singular: 'متن', plural: 'متن‌ها' },
  fields: [
    {
      name: 'body',
      type: 'richText',
      label: 'متن',
      required: true,
      validate: withRules(richText, richProseRule),
    },
  ],
};

export const StepsBlock: Block = {
  slug: 'steps',
  labels: { singular: 'مراحل', plural: 'مراحل' },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'مرحله‌ها',
      labels: { singular: 'مرحله', plural: 'مرحله‌ها' },
      maxRows: 8,
      fields: [
        proseText('title', 'عنوان مرحله', { required: true, maxLength: 60 }),
        proseTextarea('text', 'توضیح مرحله', { required: true, maxLength: 300 }),
      ],
    },
  ],
};

export const FaqBlock: Block = {
  slug: 'faq',
  labels: { singular: 'پرسش‌ها', plural: 'پرسش‌ها' },
  fields: [{ ...faqsArray(), name: 'items' }],
};

export const FactsBlock: Block = {
  slug: 'facts',
  labels: { singular: 'واقعیت‌ها', plural: 'واقعیت‌ها' },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'واقعیت‌ها',
      labels: { singular: 'واقعیت', plural: 'واقعیت‌ها' },
      minRows: 3,
      maxRows: 6,
      fields: [
        proseText('label', 'برچسب', { required: true, maxLength: 40 }),
        proseText('value', 'مقدار', { required: true, maxLength: 60 }),
      ],
    },
  ],
};

export const CalloutBlock: Block = {
  slug: 'callout',
  labels: { singular: 'نکته', plural: 'نکته‌ها' },
  fields: [
    {
      name: 'tone',
      type: 'select',
      label: 'نوع',
      defaultValue: 'info',
      options: [
        { label: 'اطلاع', value: 'info' },
        { label: 'هشدار', value: 'warning' },
      ],
    },
    proseTextarea('text', 'متن نکته', { required: true, maxLength: 400 }),
  ],
};

export const SERVICE_BLOCKS: Block[] = [ContentBlock, StepsBlock, CalloutBlock];
export const PAGE_BLOCKS: Block[] = [ContentBlock, StepsBlock, FaqBlock, FactsBlock, CalloutBlock];
