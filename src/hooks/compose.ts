import type { CollectionConfig, GlobalConfig } from 'payload';

import type { PathCollection } from '@/lib/paths';

import { auditCollection, auditGlobal } from './audit';
import { normalizeFields, type NormalizeSpec } from './normalize';
import { publicPathHooks } from './redirects';
import { EXPIRE_NOW, revalidateCollection, revalidateGlobal } from './revalidate';

type Hooks = NonNullable<CollectionConfig['hooks']>;

interface ContentHookOptions {
  normalize?: NormalizeSpec;
  /** Collections with a public path get H-PATH and H-REDIR. */
  path?: PathCollection;
  beforeValidate?: NonNullable<Hooks['beforeValidate']>;
  beforeChange?: NonNullable<Hooks['beforeChange']>;
  afterChange?: NonNullable<Hooks['afterChange']>;
  audit?: Parameters<typeof auditCollection>[0] | false;
  /** 'expire' for redirects: the proxy must see a change on the next request. */
  revalidate?: 'max' | 'expire' | false;
  docTags?: boolean;
}

/**
 * The hook chain every content collection shares, in order: normalize, own checks, path capture;
 * after the write: redirects, revalidation, audit.
 */
export function contentHooks(slug: string, options: ContentHookOptions = {}): Hooks {
  const path = options.path ? publicPathHooks(options.path) : null;
  const reval =
    options.revalidate === false
      ? null
      : revalidateCollection(
          slug,
          options.revalidate === 'expire' ? EXPIRE_NOW : 'max',
          options.docTags ?? true,
        );
  const audit = options.audit === false ? null : auditCollection(options.audit ?? {});
  return {
    beforeValidate: [
      ...(options.normalize ? [normalizeFields(options.normalize)] : []),
      ...(options.beforeValidate ?? []),
    ],
    beforeChange: [...(options.beforeChange ?? []), ...(path ? [path.beforeChange] : [])],
    afterChange: [
      ...(options.afterChange ?? []),
      ...(path ? [path.afterChange] : []),
      ...(reval ? [reval.afterChange] : []),
      ...(audit ? [audit.afterChange] : []),
    ],
    afterDelete: [
      ...(path ? [path.afterDelete] : []),
      ...(reval ? [reval.afterDelete] : []),
      ...(audit ? [audit.afterDelete] : []),
    ],
  };
}

type GlobalHooks = NonNullable<GlobalConfig['hooks']>;

/** Content globals: normalize, own steps, then revalidation (expires at once) and audit. */
export function globalHooks(
  slug: string,
  options: {
    normalize?: NormalizeSpec;
    beforeChange?: NonNullable<GlobalHooks['beforeChange']>;
  } = {},
): GlobalHooks {
  return {
    beforeValidate: options.normalize ? [normalizeFields(options.normalize)] : [],
    beforeChange: options.beforeChange ?? [],
    afterChange: [revalidateGlobal(slug), auditGlobal(slug)],
  };
}
