// Home placeholder (phase 3): no public design yet. The server HTML is the complete tier-0 page;
// ExperienceRoot adds the scroll engine and the canvas after hydration. Phase 7 replaces the
// sections with the eleven scenes of docs/experience/storyboard.md.
import { getFeatures } from '@/lib/data/globals';
import { ExperienceRoot } from '@/experience/ExperienceRoot';
import { PLACEHOLDER_SCENE_IDS } from '@/experience/scenes/registry';
import { siteCapFrom } from '@/lib/qualityTier';

export default async function HomePage() {
  const features = await getFeatures();
  const siteCap = siteCapFrom(features.qualityTierOverride);
  const [heroId, ...sceneIds] = PLACEHOLDER_SCENE_IDS;
  return (
    <ExperienceRoot siteCap={siteCap}>
      <section
        data-scene={heroId}
        data-experience-cover=""
        aria-labelledby="home-title"
        className="mx-auto flex min-h-[100dvh] max-w-content flex-col justify-center gap-4 px-gutter py-section"
      >
        <h1 id="home-title" className="font-display text-display-2 text-ink">
          کلینیک دندانپزشکی سفید
        </h1>
        <p className="max-w-measure text-body-lg text-ink-muted">سایت در حال ساخت است.</p>
      </section>
      {sceneIds.map((id) => (
        <div key={id} data-scene={id} className="min-h-[50dvh]" />
      ))}
    </ExperienceRoot>
  );
}
