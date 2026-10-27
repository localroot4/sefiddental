/**
 * Scene 0, the intro overlay (phase 7 step 0 stub; the INTRO lane fills it): a `<dialog id="intro">`
 * with its inline `<style nonce>` and the under-2 KB inline script allowed by a CSP hash (report
 * section 3). `page.tsx` renders it right after the lockup sprite and omits it when the site cap
 * is 0. The prop shape is fixed in step 0: a change is a request to the integrator.
 */
export function IntroOverlay(_props: { nonce: string | undefined }): null {
  return null;
}
