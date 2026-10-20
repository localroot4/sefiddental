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

/**
 * Every collection of the site, in admin navigation order (freeze section 6). Payload orders the
 * groups by first appearance, so «تنظیمات» (insurances, financing) comes before «سیستم» (H32).
 * No API tab anywhere: Payload has no per-role switch for it.
 */
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
  Media,
  Testimonials,
  Cases,
  Insurances,
  FinancingOptions,
  Redirects,
  EventsDaily,
  SmsThrottle,
  AuditLog,
  Users,
].map((collection) => ({ ...collection, admin: { ...collection.admin, hideAPIURL: true } }));
