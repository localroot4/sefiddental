/** The attributes and the event the journey shares with the DOM scenes (no code, no imports). */

/** Phase 8's stage attribute: the booking and footer stages are transparent under it. */
export const STAGE_ATTR = 'data-world-stage';
/** On the footer's mark part while the courier has not landed on it (the hand-off). */
export const AWAY_ATTR = 'data-courier-away';
/** Dispatched on the mark part when the courier lifts off it again (footer.ts sends it home). */
export const LIFTOFF_EVENT = 'sefid:courier-liftoff';
/** On the services mark while the courier stands in for it (D2 is the mark's own box). */
export const HERE_ATTR = 'data-courier-here';
