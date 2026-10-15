import type { AnchorHTMLAttributes, ReactNode } from 'react';

import type { Track } from './Button';
import { cx } from './cx';

/**
 * Text link (DESIGN.md 3.2): brand-strong (AA at every size), 1 px underline, and a 2 px bar
 * that grows from the start side on hover and focus. `standalone` gives the 44 px hit area of a
 * link row while the underline stays under the words; `ltr` makes it an LTR island (phone, URL).
 * Inline links inside a sentence keep no padding (WCAG 2.5.8 exemption). The group is named, so a
 * hover on an FAQ item or a step around the link does not draw its bar.
 */
export function TextLink({
  href,
  children,
  standalone = false,
  ltr = false,
  track,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  standalone?: boolean;
  ltr?: boolean;
  track?: Track;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>) {
  return (
    <a
      {...rest}
      href={href}
      dir={ltr ? 'ltr' : undefined}
      data-track={track?.event}
      data-location={track?.location}
      data-service-key={track?.serviceKey}
      className={cx(
        'group/link font-medium text-brand-strong',
        standalone && 'inline-flex min-h-target items-center px-2',
        className,
      )}
    >
      <span className="relative underline decoration-line-strong decoration-1 underline-offset-[.22em] after:absolute after:inset-x-0 after:bottom-[-.08em] after:h-[2px] after:origin-[100%_50%] after:scale-x-0 after:bg-current after:transition-transform after:content-[''] group-hover/link:after:scale-x-100 group-focus-visible/link:after:scale-x-100 ltr:after:origin-[0_50%]">
        {children}
      </span>
    </a>
  );
}
