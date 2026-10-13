// Cache tag names shared by the readers and the revalidation hooks (freeze section 5).
export const colTag = (slug: string): string => `col:${slug}`;
export const docTag = (slug: string, id: string | number): string => `doc:${slug}:${id}`;
export const globTag = (slug: string): string => `glob:${slug}`;
