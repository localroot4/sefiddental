import { BookingFormBody, type BookingFormProps } from './BookingFormBody';
import { BookingFormIsland } from './BookingFormIsland';

export type { BookingInstance } from './BookingFormBody';

/** The booking form with its island in the page's first load (hero, blocks, booking page). */
export function BookingForm(props: BookingFormProps) {
  return <BookingFormBody {...props} Island={BookingFormIsland} />;
}
