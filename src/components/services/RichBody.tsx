import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react';

import { cx } from '@/components/ui/cx';
import { buildPath, type PathCollection, type PathDoc } from '@/lib/paths';

import { ltr } from '@/components/ui/ltr';

// Lexical text format bits (bold 1, italic 2); the editor offers no other inline format.
const BOLD = 1;
const ITALIC = 2;

// Body links look like TextLink: brand-strong, underlined on the line-strong hairline.
const PROSE =
  'max-w-measure text-body text-ink [&_a]:font-medium [&_a]:text-brand-strong [&_a]:underline [&_a]:decoration-line-strong [&_a]:decoration-1 [&_a]:underline-offset-[.22em] [&_a:hover]:decoration-current [&_em]:not-italic [&_em]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-heading [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-body-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:ps-6';

/**
 * A rich-text body block as server HTML: Payload's JSX converters without the inline styles the
 * CSP blocks (text align, indent, nested list items, strikethrough), the H2s carrying the ids of
 * the in-page nav, internal links on their public paths, and Latin words as LTR islands.
 * shortcut: uploads keep Payload's default converter and a linked document's later slug change
 * waits for the page's own revalidation; phase 6 adds the `col:` tags of the linked documents.
 */
export function RichBody(props: {
  data: SerializedEditorState;
  ids: Map<object, string>;
  className?: string;
}) {
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => {
      const Tag = node.tag === 'h3' || node.tag === 'h4' ? node.tag : 'h2';
      return <Tag id={props.ids.get(node)}>{nodesToJSX({ nodes: node.children })}</Tag>;
    },
    link: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children });
      const href =
        node.fields.linkType === 'internal' ? internalHref(node.fields.doc) : node.fields.url;
      // A link to an unpublished or deleted document keeps its words and drops the dead link.
      if (!href) return <>{children}</>;
      const newTab = node.fields.newTab === true;
      return (
        <a
          href={href}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },
    listitem: ({ node, nodesToJSX }) => (
      <li value={node.value}>{nodesToJSX({ nodes: node.children })}</li>
    ),
    text: ({ node }) => {
      let out = ltr(node.text);
      if (node.format & BOLD) out = <strong>{out}</strong>;
      if (node.format & ITALIC) out = <em>{out}</em>;
      return out;
    },
  });
  return (
    <RichText
      data={props.data}
      converters={converters}
      disableIndent
      disableTextAlign
      className={cx(PROSE, props.className)}
    />
  );
}

/** The public path of an internal link's document, or null while it is unpopulated or a draft. */
function internalHref(
  doc: { relationTo: string; value: unknown } | null | undefined,
): string | null {
  if (!doc || typeof doc.value !== 'object' || doc.value === null) return null;
  if ('_status' in doc.value && doc.value._status !== 'published') return null;
  return buildPath(doc.relationTo as PathCollection, doc.value as PathDoc);
}
