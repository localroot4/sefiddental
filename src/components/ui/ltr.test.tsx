import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ltr } from '@/components/ui/ltr';

const html = (text: string) => renderToStaticMarkup(<p>{ltr(text)}</p>);

describe('LTR islands in Persian copy (CR-35)', () => {
  it('LT1 «VIP» and «CIP» in the restoration intro become LTR islands; the Persian stays put', () => {
    expect(html('سه سطح معمولی، VIP و CIP در مواد فرق دارند.')).toBe(
      '<p>سه سطح معمولی، <bdi dir="ltr">VIP</bdi> و <bdi dir="ltr">CIP</bdi> در مواد فرق دارند.</p>',
    );
  });

  it('LT2 a multi-word Latin run is one island; text without Latin is unchanged', () => {
    expect(html('نام لاتین: Sefid Dental Clinic.')).toBe(
      '<p>نام لاتین: <bdi dir="ltr">Sefid Dental Clinic</bdi>.</p>',
    );
    expect(html('رنگ‌آمیزی (characterization) تا')).toContain(
      '(<bdi dir="ltr">characterization</bdi>)',
    );
    expect(html('معمولی')).toBe('<p>معمولی</p>');
  });
});
