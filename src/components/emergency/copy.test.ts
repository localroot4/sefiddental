import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EMERGENCY_MESSAGES as M } from '@/i18n/fa-emergency';

// docs/conversion.md with each source line break read as one space (spec 0: «a line break inside
// a source string is one space»).
const SOURCE = readFileSync(path.resolve(process.cwd(), 'docs/conversion.md'), 'utf8').replace(
  /\s*\n\s*/g,
  ' ',
);
const PHONE = '۰۲۱ ۵۵۱۰ ۱۰۵۴';

/** Keys whose text conversion.md 7 gives verbatim (the rest are drafts or split around a link). */
const VERBATIM = [
  'emergency.lead.open',
  'emergency.lead.closed',
  'emergency.safety.face',
  'emergency.safety.breath',
  'emergency.safety.bleeding',
  'emergency.safety.head',
  'emergency.safety.sameDay',
  'emergency.form.intro',
  'emergency.triage.legend',
  'emergency.triage.severe_pain',
  'emergency.triage.swelling',
  'emergency.triage.broken',
  'emergency.triage.avulsion',
  'emergency.triage.bleeding',
  'emergency.triage.required',
  'emergency.avulsion.text',
  'emergency.avulsion.open',
  'emergency.avulsion.closed',
  'emergency.submit',
  'emergency.done',
] as const;

const FAILURES = [
  M['emergency.failed.expired'],
  M['emergency.failed.retry'],
  `${M['emergency.failed.network']} ${PHONE} تماس بگیرید.`,
  `${M['emergency.failed.server']} ${PHONE} تماس بگیرید.`,
];

describe('emergency copy (conversion.md 7, copy-guidelines)', () => {
  it.each(VERBATIM)('T-EM4 %s is conversion.md byte for byte (ZWNJ included)', (key) => {
    expect(SOURCE).toContain(M[key]);
  });

  it('T-EM4 the split strings join to the source sentences', () => {
    expect(SOURCE).toContain(
      `${M['emergency.safety.before']} ${M['emergency.safety.link']} ${M['emergency.safety.after']}`,
    );
    expect(SOURCE).toContain(
      `${M['emergency.repeat.before']} ${PHONE} ${M['emergency.repeat.after']}`,
    );
    expect(SOURCE).toContain(`${M['emergency.none.before']} ${M['emergency.none.link']}.`);
    // EM-D1 cuts the open lead after its first sentence and adds no word.
    expect(M['emergency.lead.open'].startsWith(`${M['emergency.lead.closingSoon']} `)).toBe(true);
  });

  it('T-EM6 every 5.2 message on this form quotes «ثبت درخواست فوری» and is otherwise 5.2', () => {
    for (const text of FAILURES) {
      expect(text).toContain('«ثبت درخواست فوری»');
      expect(SOURCE).toContain(text.replace('«ثبت درخواست فوری»', '«ثبت درخواست»'));
    }
  });

  it('EM-P4 «همان روز» only ever comes with «در صورت امکان»; no slot is promised', () => {
    for (const text of Object.values(M)) {
      if (text.includes('همان روز')) expect(text).toContain('در صورت امکان');
      expect(text).not.toMatch(/تضمین|قطعی|حتماً نوبت/);
    }
  });
});
