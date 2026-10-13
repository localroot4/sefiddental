/**
 * Local stub of `getFeatures` from `src/lib/data/globals.ts` (Lane D, freeze 3.10), reduced to
 * the one field the home page reads, so the page renders before Lane D merges. At merge: delete
 * this file and import `getFeatures` from '@/lib/data/globals' in `src/app/(site)/page.tsx`.
 */
export async function getFeatures(): Promise<{ qualityTierOverride?: string | null }> {
  return { qualityTierOverride: 'auto' };
}
