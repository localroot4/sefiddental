import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  THEME_INIT_SCRIPT,
  THEME_INIT_SCRIPT_SHA256,
  THEME_STORAGE_KEY,
} from '@/lib/theme/themeInitScript';

describe('theme init script (spec 5.5)', () => {
  it('TH1 the exported hash is the SHA-256 of the exact script bytes', () => {
    expect(createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')).toBe(
      THEME_INIT_SCRIPT_SHA256,
    );
  });

  it('TH2 pinned: an edit to the script or its hash forces a CSP review', () => {
    expect(THEME_INIT_SCRIPT).toBe(
      '(function(){try{var t=localStorage.getItem("sefid-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}})();',
    );
    expect(THEME_INIT_SCRIPT_SHA256).toBe('sbC0eqnCTp86E6nW5x/TLpLLa2TclDnb2W4oNKfyt58=');
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it('TH3 applies a stored explicit choice and ignores anything else', () => {
    const run = (stored: string | null, throws = false) => {
      const root = { dataset: {} as Record<string, string> };
      const storage = {
        getItem: () => {
          if (throws) throw new Error('blocked');
          return stored;
        },
      };
      new Function('localStorage', 'document', THEME_INIT_SCRIPT)(storage, {
        documentElement: root,
      });
      return root.dataset.theme;
    };
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
    expect(run('blue')).toBeUndefined();
    expect(run(null)).toBeUndefined();
    expect(run('dark', true)).toBeUndefined();
  });
});
