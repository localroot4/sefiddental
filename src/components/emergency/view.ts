import type { HoursState } from '@/lib/hoursState';
import type { Flash } from '@/lib/http/flash';

import type { EmergencyInitial } from './EmergencyFormIsland';

/**
 * What the hours state changes on /اورژانس (docs/conversion.md 7.1, emergency spec 4.3). Open and
 * closing soon put the call first (EM-D1: calls are allowed, but closing soon is closed for
 * promises, so its lead drops the same-day sentence and the form names the callback day). The
 * other states lead with the safety box. The page order is otherwise fixed: H1, lead, the call
 * button when calls are allowed, safety box, form, self-care, address.
 */
export interface EmergencyView {
  /** Variant A: the large «تماس با کلینیک» under the lead, and the form's «اگر تماس…» intro. */
  callFirst: boolean;
  lead: 'emergency.lead.open' | 'emergency.lead.closingSoon' | 'emergency.lead.closed';
  /** The hours line above «ثبت درخواست فوری», or none. */
  aboveSubmit: string | null;
  /** The avulsion action: call the clinic now, or go to a 24-hour center. */
  avulsion: 'call' | 'closed';
}

export function emergencyView(hours: HoursState, priorityConfirmed: boolean): EmergencyView {
  const { state, copy } = hours;
  if (state === 'open') {
    return { callFirst: true, lead: 'emergency.lead.open', aboveSubmit: null, avulsion: 'call' };
  }
  if (state === 'closing-soon') {
    return {
      callFirst: true,
      lead: 'emergency.lead.closingSoon',
      aboveSubmit: copy.callback,
      avulsion: 'call',
    };
  }
  // The priority clause is a promise reception has not confirmed yet (gap 19, EM-F9): the plain
  // callback line until the clinic global says so.
  return {
    callFirst: false,
    lead: 'emergency.lead.closed',
    aboveSubmit: (priorityConfirmed && copy.emergencyClosedLine) || copy.callback,
    avulsion: 'closed',
  };
}

const EMPTY: EmergencyInitial = {
  values: { phone: '', name: '', note: '' },
  triage: [],
  errors: {},
  notice: null,
  done: null,
};

/**
 * The form's starting state from the no-JS flash (freeze G3): the success summary, or the kept
 * values with the field errors or the notice. A direct GET (no flash) shows the empty form, never
 * a success (EM-F15).
 */
export function initialFromFlash(flash: Flash | null): EmergencyInitial {
  if (flash?.form !== 'emergency') return EMPTY;
  if (flash.outcome === 'success') {
    return { ...EMPTY, done: { callback: flash.callback ?? null, masked: flash.masked ?? '' } };
  }
  const values = flash.values ?? {};
  return {
    values: { phone: values.phone ?? '', name: values.name ?? '', note: values.note ?? '' },
    triage: flash.triage ?? [],
    errors: flash.outcome === 'invalid' ? (flash.errors ?? {}) : {},
    notice: flash.outcome === 'invalid' ? null : flash.outcome,
    done: null,
  };
}
