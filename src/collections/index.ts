import type { CollectionConfig } from 'payload';

import { Articles } from './Articles';
import { Bookings } from './Bookings';
import { Cases } from './Cases';
import { Doctors } from './Doctors';
import { FinancingOptions } from './FinancingOptions';
import { Insurances } from './Insurances';
import { Media } from './Media';
import { Pages } from './Pages';
import { Redirects } from './Redirects';
import { ServiceCategories } from './ServiceCategories';
import { Services } from './Services';
import { ServiceTiers } from './ServiceTiers';
import { SmsThrottle } from './SmsThrottle';
import { AuditLog, EventsDaily } from './System';
import { ArticleCategories, Tags } from './Taxonomies';
import { Testimonials } from './Testimonials';
import { Users } from './Users';

/** Every collection of the site, in admin navigation order within each group (freeze section 6). */
export const collections: CollectionConfig[] = [
  Bookings,
  Pages,
  ServiceCategories,
  Services,
  ServiceTiers,
  Doctors,
  Articles,
  ArticleCategories,
  Tags,
  Insurances,
  FinancingOptions,
  Media,
  Testimonials,
  Cases,
  Redirects,
  EventsDaily,
  SmsThrottle,
  AuditLog,
  Users,
];
