import { describe, expect, it } from 'vitest';

import { persianHeading } from './richText';

type Built = { i18n: Record<string, { label: string }> };

describe('rich-text editor', () => {
  it('RT1 the heading label is Persian, other languages keep Lexical’s (H34)', async () => {
    const build = persianHeading().feature as (args: never) => Promise<Built>;
    const built = await build({ props: undefined } as never);
    expect(built.i18n.fa!.label).toBe('تیتر {{headingLevel}}');
    expect(built.i18n.en!.label).toBe('Heading {{headingLevel}}');
  });
});
