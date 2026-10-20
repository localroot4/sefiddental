import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  lexicalEditor,
  LinkFeature,
  UploadFeature,
} from '@payloadcms/richtext-lexical';

import { ARTICLE_BLOCKS } from '@/blocks/articleBlocks';

// Formatting that has no place in clinic copy; heading, link and upload come back configured.
const REMOVED = new Set([
  'subscript',
  'superscript',
  'inlineCode',
  'checklist',
  'align',
  'indent',
  'strikethrough',
  'underline',
  'heading',
  'link',
  'upload',
]);

/**
 * H34: Lexical ships the Persian heading label as '[SKIPPED]' and merges a feature's strings over
 * the config's translations, so the label is replaced on the feature itself.
 */
export function persianHeading() {
  const provider = HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] });
  const feature = provider.feature as Extract<typeof provider.feature, (...args: never) => unknown>;
  return {
    ...provider,
    feature: async (args: Parameters<typeof feature>[0]) => {
      const built = await feature(args);
      return { ...built, i18n: { ...built.i18n, fa: { label: 'تیتر {{headingLevel}}' } } };
    },
  } as typeof provider;
}

const configured = () => [
  persianHeading(),
  LinkFeature({ enabledCollections: ['services', 'articles', 'pages', 'doctors'] }),
  UploadFeature({ enabledCollections: ['media'] }),
  FixedToolbarFeature(),
];

/** The one rich-text editor (spec-data 5.6): the page H1 is never in the body, so h2-h4 only. */
export const richTextEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => !REMOVED.has(feature.key)),
    ...configured(),
  ],
});

/** H8: the article body adds the callout, table and video blocks; other bodies keep the editor. */
export const articleEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => !REMOVED.has(feature.key)),
    ...configured(),
    BlocksFeature({ blocks: ARTICLE_BLOCKS }),
  ],
});
