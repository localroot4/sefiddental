/**
 * The DOM contract between the server-rendered chrome and its one behavior island
 * (ChromeScripts): element ids and the opt-in attributes other templates may use.
 *
 * - `data-call-sheet` on a `tel:` link or any ancestor: the call goes through the closed-hours
 *   sheet while the clinic is closed (C13). Phone numbers in sentences and the footer NAP block
 *   stay plain links.
 * - `data-booking-cta` on a «رزرو نوبت» link: on a page with a booking form the click focuses or
 *   scrolls to it (nav spec 1.6 and 4); on a page with the booking dialog (`data-booking-dialog`,
 *   BOOKING_DIALOG_ID) it opens the dialog (freeze G7); otherwise the link navigates. A link's
 *   `?service=` and `?tier=` and its `data-booking-group` fill the form it routes to.
 * - `data-sticky-hide` on a block: the sticky bar hides while any part of it is in view (CV4 a).
 * - `data-sticky-bar` marks the bar; its height is 64 px plus the bottom safe area.
 */
export const DRAWER_ID = 'site-drawer';
export const SHEET_ID = 'closed-sheet';
export const MEGA_ID = 'mega-menu';
export const BOOKING_DIALOG_ID = 'booking-dialog';
