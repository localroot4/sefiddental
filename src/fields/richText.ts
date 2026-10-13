import {
  FixedToolbarFeature,
  HeadingFeature,
  lexicalEditor,
  LinkFeature,
  UploadFeature,
} from '@payloadcms/richtext-lexical';

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

/** The one rich-text editor (spec-data 5.6): the page H1 is never in the body, so h2-h4 only. */
export const richTextEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((feature) => !REMOVED.has(feature.key)),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    LinkFeature({ enabledCollections: ['services', 'articles', 'pages', 'doctors'] }),
    UploadFeature({ enabledCollections: ['media'] }),
    FixedToolbarFeature(),
  ],
});
