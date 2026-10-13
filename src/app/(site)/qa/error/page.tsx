import { notFound } from 'next/navigation';

import { readEnv } from '@/lib/env';

// Screenshot and axe target of the branded 500 (critic G11): throws during render, so
// (site)/error.tsx renders. QA_ROUTES=1 only, read at request time; otherwise a real 404.
export const dynamic = 'force-dynamic';

export default function QaError(): never {
  if (!readEnv().qaRoutes) notFound();
  throw new Error('qa_render_error: intentional render error for the 500 page check');
}
