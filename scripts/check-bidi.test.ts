import { describe, expect, it } from 'vitest';

import { findBidiControls } from './check-bidi.mjs';

describe('check-bidi', () => {
  it('T-BD1 finds each bidi control with line, column and code point', () => {
    const text = `const a = 'x';\nconst b = '\u202Eevil\u2066';\n// \u200F`;
    expect(findBidiControls(text)).toEqual([
      { line: 2, column: 12, codePoint: 'U+202E' },
      { line: 2, column: 17, codePoint: 'U+2066' },
      { line: 3, column: 4, codePoint: 'U+200F' },
    ]);
  });

  it('T-BD2 Persian text, ZWNJ and escapes are clean', () => {
    const text = "const label = 'نیم‌فاصله';\nconst lrm = '\\u200E';";
    expect(findBidiControls(text)).toEqual([]);
  });
});
