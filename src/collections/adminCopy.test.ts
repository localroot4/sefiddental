// Acceptance 2 (docs/prompts/06-content-seo.md 2b): every label, option and help text the staff
// read is Persian, and the navigation follows the daily tasks (H32, H34). The test walks the
// configs themselves, so a field added later is checked without a new line here.
import { en } from '@payloadcms/translations/languages/en';
import { fa } from '@payloadcms/translations/languages/fa';
import type { CollectionConfig, Field, GlobalConfig, Option, Tab } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { PAYLOAD_FA_OVERRIDES } from '@/i18n/fa-admin';

// Media and Users read the environment while their module loads.
vi.stubEnv('DATABASE_URL', 'file:./.data/test.db');
vi.stubEnv('PAYLOAD_SECRET', 'p'.repeat(43));
const { collections } = await import('.');
const { globals } = await import('../globals');

type Entity = CollectionConfig | GlobalConfig;

/** H32: the five groups, in this order in the admin's navigation. */
const GROUPS = ['نوبت‌ها', 'محتوا', 'بیماران و نظرات', 'تنظیمات', 'سیستم'];

/**
 * H34: the only Latin words staff may read: source publishers, file formats, the clinic's tier
 * names (as on the public site), and the plugin's authenticator app name.
 */
const ALLOWED = new Set([
  ...['ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT'],
  ...['JPEG', 'JPG', 'PNG', 'HEIC', 'MP4', 'WebM', 'AVIF', 'WebP'],
  ...['VIP', 'CIP', 'NEEDS_CLIENT'],
]);

// A Persian letter or digit (the graphics tier options are «۰» to «۳»).
const PERSIAN_LETTER =
  /[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u06F0-\u06F9]/;

/** Latin words left after URLs, emails, HTML tags and {{placeholders}} are taken out. */
function latinWords(text: string): string[] {
  const plain = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{\{?\w+\}?\}/g, ' ');
  return (plain.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []).filter((word) => !ALLOWED.has(word));
}

/** Persian text: at least one Persian letter and no Latin word outside the allowlist. */
const isPersian = (text: unknown): boolean =>
  typeof text === 'string' &&
  (PERSIAN_LETTER.test(text) || ALLOWED.has(text)) &&
  latinWords(text).length === 0;

type Problem = string;

/** Every label and option a staff member can see in the field tree, as `path: problem`. */
function fieldProblems(fields: readonly Field[], path: string, checkHelp: boolean): Problem[] {
  const problems: Problem[] = [];
  for (const field of fields) {
    const f = field as Field & {
      name?: string;
      label?: unknown;
      labels?: { singular?: unknown; plural?: unknown };
      hidden?: boolean;
      admin?: { hidden?: boolean; description?: unknown; disableListColumn?: boolean };
      options?: Option[];
      fields?: Field[];
      tabs?: Tab[];
      blocks?: Array<{
        slug: string;
        labels?: { singular?: unknown; plural?: unknown };
        fields: Field[];
      }>;
    };
    const at = f.name ? `${path}.${f.name}` : path;
    if (f.hidden || f.admin?.hidden) continue;
    const named = Boolean(f.name);
    const needsLabel =
      f.type === 'collapsible' || (named && !(f.type === 'ui' && f.admin?.disableListColumn));
    if (needsLabel && f.label !== false && !isPersian(f.label)) {
      problems.push(`${at}: label ${JSON.stringify(f.label ?? null)}`);
    }
    // Without labels Payload names an array's rows from its field name («Add Duplicate
    // Submission», «This field has no Duplicate Submissions»).
    if (f.type === 'array' && !f.labels) problems.push(`${at}: array without labels`);
    if (f.labels) {
      for (const label of [f.labels.singular, f.labels.plural]) {
        if (!isPersian(label)) problems.push(`${at}: labels ${JSON.stringify(label)}`);
      }
    }
    if (checkHelp && typeof f.admin?.description === 'string') {
      const words = latinWords(f.admin.description);
      if (words.length) problems.push(`${at}: description has ${words.join(', ')}`);
    }
    for (const option of f.options ?? []) {
      const label = typeof option === 'string' ? option : option.label;
      if (!isPersian(label)) problems.push(`${at}: option ${JSON.stringify(label)}`);
    }
    if (f.fields) problems.push(...fieldProblems(f.fields, at, checkHelp));
    for (const tab of f.tabs ?? []) {
      const tabPath = 'name' in tab && tab.name ? `${at}.${tab.name}` : at;
      if (!isPersian(tab.label))
        problems.push(`${tabPath}: tab ${JSON.stringify(tab.label ?? null)}`);
      problems.push(...fieldProblems(tab.fields, tabPath, checkHelp));
    }
    for (const block of f.blocks ?? []) {
      for (const label of [block.labels?.singular, block.labels?.plural]) {
        if (!isPersian(label)) problems.push(`${at}.${block.slug}: block labels`);
      }
      problems.push(...fieldProblems(block.fields, `${at}.${block.slug}`, checkHelp));
    }
  }
  return problems;
}

const isCollection = (entity: Entity): entity is CollectionConfig => 'labels' in entity;
const editor = { role: 'editor' };
const admin = { role: 'admin' };

/** Payload's `admin.hidden` for a user: a boolean or a function of the client user. */
function hiddenFor(entity: Entity, user: object): boolean {
  const hidden = entity.admin?.hidden;
  return typeof hidden === 'function' ? hidden({ user } as never) : Boolean(hidden);
}

/** What Payload's nav shows (groupNavItems): groups by first appearance, collections first. */
function navFor(user: object): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const entity of [...collections, ...globals]) {
    if (hiddenFor(entity, user)) continue;
    const group = String(entity.admin?.group);
    groups.set(group, [...(groups.get(group) ?? []), entity.slug]);
  }
  return [...groups];
}

/** Entities an editor opens: visible in the nav, plus the account view of `users`. */
const editorVisible = (entity: Entity) => !hiddenFor(entity, editor) || entity.slug === 'users';

describe('admin copy and navigation (H32, H34)', () => {
  it('AC1 every collection and global hides the API tab', () => {
    for (const entity of [...collections, ...globals]) {
      expect(entity.admin?.hideAPIURL, entity.slug).toBe(true);
    }
  });

  it('AC2 every entity sits in one of the five groups; admins see them in task order', () => {
    for (const entity of [...collections, ...globals]) {
      expect(GROUPS, entity.slug).toContain(entity.admin?.group);
    }
    expect(navFor(admin).map(([group]) => group)).toEqual(GROUPS);
    expect(navFor(admin).find(([group]) => group === 'تنظیمات')?.[1]).toEqual([
      'insurances',
      'financing-options',
      'clinic',
      'seo-defaults',
      'features',
      'notifier',
    ]);
  });

  it('AC3 the editor navigation is bookings, content and patients only', () => {
    expect(navFor(editor)).toEqual([
      ['نوبت‌ها', ['bookings']],
      ['محتوا', ['articles', 'tags', 'media']],
      ['بیماران و نظرات', ['testimonials', 'cases']],
    ]);
  });

  it('AC4 collection and global names are Persian', () => {
    for (const entity of [...collections, ...globals]) {
      const names = isCollection(entity)
        ? [entity.labels?.singular, entity.labels?.plural]
        : [entity.label];
      for (const name of names)
        expect(isPersian(name), `${entity.slug}: ${String(name)}`).toBe(true);
    }
  });

  it('AC5 every visible field label and option is Persian', () => {
    const problems = [...collections, ...globals].flatMap((entity) =>
      fieldProblems(entity.fields, entity.slug, false),
    );
    expect(problems).toEqual([]);
  });

  it('AC6 help text an editor reads has no Latin word outside the H34 allowlist', () => {
    const editorEntities = [...collections, ...globals].filter(editorVisible);
    expect(editorEntities.map((e) => e.slug)).toEqual(
      expect.arrayContaining(['bookings', 'articles', 'tags', 'media', 'testimonials', 'cases']),
    );
    const problems = editorEntities.flatMap((entity) => {
      const own =
        typeof entity.admin?.description === 'string' ? latinWords(entity.admin.description) : [];
      return [
        ...(own.length ? [`${entity.slug}: description has ${own.join(', ')}`] : []),
        ...fieldProblems(entity.fields, entity.slug, true),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('AC7 Payload’s own Persian strings have no Latin word once the overrides apply', () => {
    const merged = merge(fa.translations, PAYLOAD_FA_OVERRIDES);
    const problems: string[] = [];
    walk(en.translations, (key) => {
      const text = get(merged, key);
      if (typeof text !== 'string') problems.push(`${key}: missing`);
      else if (latinWords(text).length) problems.push(`${key}: ${text}`);
    });
    expect(problems).toEqual([]);
  });

  it('AC8 the overrides only replace keys Payload has', () => {
    walk(PAYLOAD_FA_OVERRIDES, (key) => {
      expect(typeof get(en.translations, key), key).toBe('string');
      expect(isPersian(get(PAYLOAD_FA_OVERRIDES, key)), key).toBe(true);
    });
  });
});

type Tree = { [key: string]: string | Tree };

function walk(tree: object, visit: (key: string) => void, prefix = ''): void {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'object' && value) walk(value, visit, `${prefix}${key}.`);
    else visit(`${prefix}${key}`);
  }
}

function get(tree: object, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

function merge(base: object, over: object): Tree {
  const out: Tree = { ...(base as Tree) };
  for (const [key, value] of Object.entries(over)) {
    out[key] = typeof value === 'object' ? merge((out[key] as Tree) ?? {}, value) : value;
  }
  return out;
}
