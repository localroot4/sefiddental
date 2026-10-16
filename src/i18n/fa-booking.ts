/*
 * Admin copy of the public booking pipeline's own fields on a booking record (security review
 * S4, S10). Staff-facing; the copy rules apply (ZWNJ, Persian digits, no em dash). Merged into
 * MESSAGES in src/i18n/fa.ts.
 */
export const BOOKING_MESSAGES = {
  'booking.sidHash.label': 'اثر مرورگر',
  'booking.appendsDropped.label': 'تکراری‌های ثبت‌نشده',
  'booking.appendsDropped.help':
    'این تعداد درخواست تکراری بعد از ۲۰ مورد بالا رسید و متن‌شان ذخیره نشد. با بیمار تماس بگیرید.',
} as const;
