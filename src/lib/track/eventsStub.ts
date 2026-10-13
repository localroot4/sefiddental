/**
 * Local stub of `src/lib/events/allowlist.ts` (Lane D, freeze 3.12), same names and values, so
 * the client tracker type-checks before Lane D merges. At merge: delete this file and import from
 * '@/lib/events/allowlist' in track.ts and TrackListener.tsx.
 */
export const EVENT_NAMES = [
  'booking_open',
  'booking_submit',
  'booking_success',
  'booking_error',
  'call_click',
  'closed_sheet_view',
  'whatsapp_click',
  'directions_click',
  'emergency_submit',
  'tier_select',
  'case_slider_use',
  'save_contact',
  'content_to_service',
  'theme_toggle',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
