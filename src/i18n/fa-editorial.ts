/*
 * Editorial copy of the admin (phase 6, H11, C26): the article checklist and the SERP preview.
 * Staff-facing; the copy rules apply (ZWNJ, Persian digits, no em dash). Placeholders are {name};
 * values are filled in by editorialText. The publish messages themselves live with their rules in
 * src/fields/validators.ts, so the checklist and the publish gate show the same words.
 */
export const EDITORIAL_MESSAGES = {
  'editorial.check.title': 'عنوان در نتیجهٔ گوگل',
  'editorial.check.description': 'توضیح سئو',
  'editorial.check.slug': 'نشانی',
  'editorial.check.cover': 'تصویر شاخص و متن جایگزین',
  'editorial.check.author': 'نویسنده',
  'editorial.check.primaryService': 'خدمت اصلی',
  'editorial.check.headings': 'دست‌کم دو «تیتر ۲»',
  'editorial.check.links': 'پیوند به یک خدمت و یک راهنما',
  'editorial.check.sources': 'منبع علمی',
  'editorial.check.reviewer': 'بازبین پزشکی',
  'editorial.check.reviewedAt': 'تاریخ بازبینی',
  'editorial.check.approval': 'تأیید مدیر',
  'editorial.check.prose': 'بدون علامت جای خالی و واژهٔ ممنوع',
  'editorial.checklist.heading': 'پیش از انتشار',
  'editorial.checklist.lead': 'انتشار تا وقتی همهٔ موارد زیر تیک نخورده‌اند ممکن نیست.',
  'editorial.checklist.pass': 'انجام شد',
  'editorial.checklist.pending': 'در حال بررسی',
  'editorial.checklist.count': '{done} از {total} مورد انجام شده است.',
  'editorial.checklist.manualHeading': 'برای نوشتن',
  'editorial.manual.intent': 'روشن کنید خواننده با این عنوان دنبال چه پاسخی است.',
  'editorial.manual.question': 'هر «تیتر ۲» به یک پرسش خواننده پاسخ بدهد.',
  'editorial.manual.plain':
    'جمله‌ها کوتاه و واژه‌ها ساده باشند؛ هر اصطلاح پزشکی را بار اول توضیح دهید.',
  'editorial.manual.source': 'برای هر ادعای درمانی یک منبع علمی بگذارید.',
  'editorial.manual.cta': 'فقط یک دعوت به اقدام: کادر خدمت اصلی در انتهای مقاله.',
  'editorial.manual.image':
    'تصویر واقعی و مرتبط انتخاب کنید؛ متن جایگزینش بگوید در تصویر چه دیده می‌شود.',
  'editorial.serp.heading': 'پیش‌نمایش در گوگل',
  'editorial.serp.titleCount': 'عنوان: {count} نویسه',
  'editorial.serp.descriptionCount': 'توضیح: {count} نویسه',
  'editorial.serp.titleLong': 'بلندتر از ۶۰ نویسه؛ در گوگل بریده می‌شود و انتشار ممکن نیست.',
  'editorial.serp.titleShort': 'کوتاه‌تر از ۵۰ نویسه؛ ۵۰ تا ۶۰ نویسه جای بیشتری در گوگل می‌گیرد.',
  'editorial.serp.titleOk': 'اندازهٔ عنوان مناسب است.',
  'editorial.serp.descriptionEmpty':
    'توضیح سئو خالی است؛ گوگل خودش تکه‌ای از متن صفحه را نشان می‌دهد.',
  'editorial.serp.descriptionOut': 'توضیح سئو باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.',
  'editorial.serp.descriptionOk': 'اندازهٔ توضیح مناسب است.',
  'editorial.serp.noPath': 'نشانی پس از نوشتن عنوان یا نشانی ساخته می‌شود.',
} as const;

export type EditorialMessageKey = keyof typeof EDITORIAL_MESSAGES;

/** The message with its {placeholders} filled in. */
export function editorialText(
  key: EditorialMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return EDITORIAL_MESSAGES[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? ''),
  );
}
