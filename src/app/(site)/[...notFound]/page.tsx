import { notFound } from 'next/navigation';

/**
 * Every URL no other route matches lands here and renders the branded (site)/not-found.tsx
 * inside the site layout (spec D-P11): status 404 before streaming, per request with the CSP
 * nonce, never Next's prerendered default page. Covers /en and /en/* too.
 */
export default function UnmatchedPath(): never {
  notFound();
}
