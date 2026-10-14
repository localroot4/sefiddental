import { BrandLogo } from '@/components/layout/BrandLogo';

import styles from './Brand.module.css';

/** `admin.components.graphics.Logo`: the approved lockup on the login screens (gap 1 closed). */
export function Logo() {
  return <BrandLogo className={styles.logo} label="کلینیک دندانپزشکی سفید" />;
}
