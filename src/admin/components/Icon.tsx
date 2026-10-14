import { BRAND_LOCKUP } from '@/lib/system-pages/staticPage';

import styles from './Brand.module.css';

/** The mark's own box inside the lockup coordinates (design/brand/logo-mark.svg). */
export const MARK_VIEW_BOX = '982.3 119.0 184.0 222.9';

/** `admin.components.graphics.Icon`: the brand mark in the navigation. */
export function Icon() {
  return (
    <svg viewBox={MARK_VIEW_BOX} className={styles.icon} aria-hidden="true" focusable="false">
      <path fill="#00827A" fillRule="evenodd" d={BRAND_LOCKUP.markPath} />
    </svg>
  );
}
