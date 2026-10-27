import type { Block } from 'payload';

import {
  faqsArray,
  imageUpload,
  persianRichText,
  proseText,
  proseTextarea,
  withRules,
} from '@/fields/factories';
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
      validate: withRules(persianRichText, richProseRule),
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

/**
 * The home page's digital-workflow scene (phase 7, D2): four steps with a title, a line and a 4:3
 * photo. It stays unpublished until the client confirms gap 48; the home renders nothing without it.
 */
export const WorkflowBlock: Block = {
  slug: 'workflow',
  labels: { singular: 'روش دیجیتال', plural: 'روش دیجیتال' },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'گام‌ها',
      labels: { singular: 'گام', plural: 'گام‌ها' },
      minRows: 1,
      maxRows: 4,
      fields: [
        proseText('title', 'عنوان گام', { required: true, maxLength: 40 }),
        proseTextarea('text', 'توضیح گام', { required: true, maxLength: 160 }),
        imageUpload('photo', 'عکس گام', 'عکس ۴:۳ از همین گام در کلینیک.', true),
      ],
    },
  ],
};

export const SERVICE_BLOCKS: Block[] = [ContentBlock, StepsBlock, CalloutBlock];
export const PAGE_BLOCKS: Block[] = [
  ContentBlock,
  StepsBlock,
  FaqBlock,
  FactsBlock,
  CalloutBlock,
  WorkflowBlock,
];
