import type { CollectionBeforeValidateHook } from 'payload';
import { ValidationError } from 'payload';

/**
 * H-NS (spec-data 6.3): services and categories share `/خدمات/{slug}`, so a slug is unique
 * across both. Runs after the slug field hook, so `data.slug` is already a persianSlug. Trashed
 * documents still own their slug (they can be restored).
 */
export const sharedServiceSlug =
  (other: 'services' | 'service-categories'): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, collection, req }) => {
    const slug = data?.slug ?? originalDoc?.slug;
    if (typeof slug !== 'string' || slug === '') return data;
    const { totalDocs } = await req.payload.count({
      collection: other,
      where: { slug: { equals: slug } },
      trash: true,
      req,
    });
    if (totalDocs > 0) {
      const owner = other === 'services' ? 'خدمت' : 'دسته';
      throw new ValidationError({
        collection: collection.slug,
        errors: [{ path: 'slug', message: `این نشانی برای یک ${owner} دیگر استفاده شده است.` }],
      });
    }
    return data;
  };
