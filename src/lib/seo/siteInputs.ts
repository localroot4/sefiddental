import type { ClinicJsonLdInput } from '@/lib/seo/jsonld';
import type { SeoDefaults } from '@/lib/seo/metadata';

// Static inputs until wave 2: Lane P maps getSeoDefaults() and getClinic() to these shapes.
// Values from docs/content/clinic.yaml. One module, because the (site) layout and the global 404
// document both render the metadata and the Dentist and WebSite JSON-LD from them.
export const SEO: SeoDefaults = {
  siteName: 'کلینیک دندانپزشکی سفید',
  titleSuffix: ' | کلینیک دندانپزشکی سفید',
  shortTitleSuffix: ' | کلینیک سفید',
};

export const CLINIC: ClinicJsonLdInput = {
  name: 'کلینیک دندانپزشکی سفید',
  alternateNames: ['کلینیک سفید', 'Sefid Dental Clinic'],
  telephone: '+982155101054',
  address: {
    street: 'خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲',
    locality: 'تهران',
    region: 'تهران',
    country: 'IR',
  },
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
};
