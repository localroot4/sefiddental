import { BRAND_LOCKUP } from '@/lib/system-pages/staticPage';

/**
 * Brand lockup without the Latin line, inline so the wordmark follows the theme ink
 * (currentColor) while the mark keeps the logo teal. Server component: the path data comes from
 * the static page module, which holds the one copy outside design/brand.
 */
export function BrandLogo(props: { className?: string; label: string }) {
  return (
    <svg
      viewBox={BRAND_LOCKUP.viewBox}
      role="img"
      aria-label={props.label}
      className={props.className}
    >
      <path fill="currentColor" fillRule="evenodd" d={BRAND_LOCKUP.wordmarkPath} />
      <path fill="#00827A" fillRule="evenodd" d={BRAND_LOCKUP.markPath} />
    </svg>
  );
}
