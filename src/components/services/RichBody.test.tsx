import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { lexicalFrom } from '@/seed/transforms';

import { ltr } from '@/components/ui/ltr';
import { RichBody } from './RichBody';
import { headingAnchors } from './view';

describe('services rich text', () => {
  it('SE8 renders headings with their anchor ids and no inline style the CSP would block', () => {
    const data = lexicalFrom('## ترمیم VIP چیست؟\nمتن ساده\n\n- مورد اول\n- مورد دوم');
    const root = data.root as unknown as { children: Array<Record<string, unknown>> };
    // Formats the CSP-safe renderer must flatten: alignment, indent, a nested list item, a
    // strikethrough and an italic run.
    Object.assign(root.children[1]!, { format: 'center', indent: 2 });
    const list = root.children[2] as { children: Array<{ children: unknown[] }> };
    list.children[0]!.children.push({
      type: 'list',
      listType: 'bullet',
      tag: 'ul',
      version: 1,
      children: [],
    });
    const text = (root.children[1] as { children: Array<Record<string, unknown>> }).children[0]!;
    Object.assign(text, { format: 4 | 2 });
    const { ids } = headingAnchors([data]);
    const html = renderToStaticMarkup(<RichBody data={data as never} ids={ids} />);
    expect(html).toContain('<h2 id="ترمیم-vip-چیست">ترمیم <bdi dir="ltr">VIP</bdi> چیست؟</h2>');
    expect(html).toContain('<em>');
    expect(html).toContain('<li value="1">');
    expect(html).not.toMatch(/style=/);
  });

  it('SE10 internal links go to the public path; an unpublished or unpopulated target is plain text', () => {
    const link = (text: string, value: unknown) => ({
      type: 'link',
      version: 3,
      fields: { linkType: 'internal', newTab: false, doc: { relationTo: 'services', value } },
      children: [
        { type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' },
      ],
    });
    const data = lexicalFrom('متن');
    const paragraph = (data.root as unknown as { children: Array<{ children: unknown[] }> })
      .children[0]!;
    paragraph.children = [
      link('لمینت', { id: 1, slug: 'لمینت-سرامیکی', _status: 'published' }),
      link('پیش‌نویس', { id: 2, slug: 'پیش-نویس', _status: 'draft' }),
      link('شناسه', 3),
    ];
    const html = renderToStaticMarkup(<RichBody data={data as never} ids={new Map()} />);
    expect(html).toContain('<a href="/خدمات/لمینت-سرامیکی">لمینت</a>');
    expect(html).toContain('پیش‌نویس');
    expect(html).toContain('شناسه');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain('href="#"');
  });

  it('SE9 Latin runs become LTR islands; Persian-only text stays a string', () => {
    expect(renderToStaticMarkup(<p>{ltr('سطح VIP و CIP یا Sefid Dental')}</p>)).toBe(
      '<p>سطح <bdi dir="ltr">VIP</bdi> و <bdi dir="ltr">CIP</bdi> یا <bdi dir="ltr">Sefid Dental</bdi></p>',
    );
    expect(ltr('ترمیم دندان')).toBe('ترمیم دندان');
  });

  it("SE11 an article block never prints Payload's «unknown node» (its converter waits for step 2)", () => {
    const data = lexicalFrom('## بخش\nمتن');
    const root = data.root as unknown as { children: unknown[] };
    for (const blockType of ['callout', 'table', 'video']) {
      root.children.push({
        type: 'block',
        version: 2,
        format: '',
        fields: { id: blockType, blockType },
      });
    }
    const html = renderToStaticMarkup(<RichBody data={data as never} ids={new Map()} />);
    expect(html).not.toContain('unknown node');
    expect(html).toContain('متن');
  });
});
