import type { ReactNode } from 'react';

// Root layout of the TBT floor page alone: no site CSS, chrome or client components, so the page
// loads only what Next.js itself ships (see page.tsx).
export default function FloorLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
