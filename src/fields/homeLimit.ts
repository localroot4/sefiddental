import type { CheckboxField, CollectionSlug, PayloadRequest } from 'payload';
import { checkbox } from 'payload/shared';

import { withRules } from './factories';
import { homeLimitRule } from './validators';

/**
 * V-HOME3: a home-page flag that at most `max` published documents may carry. Checked when the
 * document is published with the flag on (the three collections that use it have drafts).
 */
export function homeFlag(
  collection: CollectionSlug,
  name: string,
  label: string,
  max: number,
  description: string,
): CheckboxField {
  return {
    name,
    type: 'checkbox',
    label,
    defaultValue: false,
    validate: withRules(checkbox, async (value, options) => {
      const { req, data, event } = options as {
        req: PayloadRequest;
        data: Record<string, unknown>;
        event?: string;
      };
      const id = (options as { id?: number | string }).id;
      if (value !== true || event !== 'submit') return true;
      if (data._status !== 'published') return true;
      const { totalDocs } = await req.payload.count({
        collection,
        where: {
          and: [
            { [name]: { equals: true } },
            { _status: { equals: 'published' } },
            ...(id !== undefined ? [{ id: { not_equals: id } }] : []),
          ],
        },
        req,
      });
      return homeLimitRule(totalDocs, max);
    }),
    admin: { description },
  };
}
