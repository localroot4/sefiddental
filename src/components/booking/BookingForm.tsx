/**
 * The one booking form (docs/conversion.md 5.1): `compact` in the home hero card, `full` in the
 * home scene 10 block and on other pages. Phase 4 ships markup and client validation; phase 5
 * wires submission. Without JavaScript it posts to /رزرو-نوبت.
 */
export type BookingFormProps = {
  variant: 'compact' | 'full';
  /** Prefix of every id and the `location` of booking_submit: `hero`, `block`, `page`, ... */
  instance: string;
  /** Slug of the service to preselect (service pages, tier steps). */
  service?: string;
};

// shortcut: placeholder until the HOME lane builds the form; same props, same import path.
export function BookingForm(props: BookingFormProps) {
  return <div data-booking-form={props.instance} data-variant={props.variant} />;
}
