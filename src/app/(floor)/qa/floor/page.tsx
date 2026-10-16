import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { readEnv } from '@/lib/env';

// The framework floor for the Lighthouse TBT gate (docs/brief.md section 7): a page of this build
// with no code of ours, measured on the same host in the same run as the real pages, so the gate
// can tell our main-thread work from the speed of a shared CI runner (scripts/lhci.mjs).
// QA_ROUTES=1 only, read at request time; otherwise a real 404. Never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'floor', robots: { index: false } };

export default function QaFloor() {
  if (!readEnv().qaRoutes) notFound();
  return <p>floor</p>;
}
