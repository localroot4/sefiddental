import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { JsonLd } from '@/components/seo/JsonLd';

describe('JsonLd', () => {
  it('JL1 renders a data block that cannot be closed by its content', () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ '@type': 'WebSite', name: '</script><script>x</script>' }} />,
    );
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
  });

  it('JL2 renders nothing for null', () => {
    expect(renderToStaticMarkup(<JsonLd data={null} />)).toBe('');
  });
});
