import { serializeJsonLd } from '@/lib/seo/jsonld';

/**
 * `<script type="application/ld+json">` (ND-jsonld): a data block, not executed, so the CSP
 * neither needs nor checks a nonce for it. '<' is escaped so data cannot close the tag.
 */
export function JsonLd(props: { data: object | null }) {
  if (props.data === null) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(props.data) }}
    />
  );
}
