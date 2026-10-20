/*
 * Admin copy of the old-URL CSV import (phase 6 H19, plan section 6): the form on the Redirects
 * list, the dry-run table and the reasons a row is refused. Admin-facing; the copy rules apply
 * (ZWNJ, Persian digits, no em dash). Placeholders are {name}; values are filled in by
 * redirectsText. The field rules of a redirect keep their words in src/hooks/redirects.ts.
 */
export const REDIRECTS_MESSAGES = {
  'redirects.import.title': 'ورود نشانی‌های سایت قبلی از فایل',
  'redirects.import.intro':
    'هر سطر فایل: نشانی قدیمی، مقصد در همین سایت، و برای صفحهٔ حذف‌شده کد ۴۱۰ با مقصد خالی. ستون‌ها با ویرگول، نقطه‌ویرگول یا تب جدا می‌شوند، پس فایل CSV اکسل را همان‌طور که ذخیره شده انتخاب کنید. سطر عنوان اختیاری است. اول بررسی کنید؛ تا «ثبت» را نزنید چیزی ذخیره نمی‌شود.',
  'redirects.import.origins': 'دامنه‌های سایت قبلی',
  'redirects.import.originsHelp':
    'با ویرگول جدا کنید. نشانی کامل این دامنه‌ها به مسیر تبدیل می‌شود و نشانی دامنه‌های دیگر رد می‌شود.',
  'redirects.import.file': 'فایل',
  'redirects.import.chooseFile': 'اول فایل را انتخاب کنید.',
  'redirects.import.check': 'بررسی بدون ذخیره',
  'redirects.import.checking': 'در حال بررسی',
  'redirects.import.apply': 'ثبت {n} ردیف',
  'redirects.import.applying': 'در حال ثبت',
  'redirects.import.applied': '{n} ردیف ثبت شد.',
  'redirects.import.nothing': 'ردیفی برای ثبت نیست.',
  'redirects.import.summary':
    '{new} ردیف تازه، {update} به‌روزرسانی، {unchanged} بدون تغییر، {refused} ردشده، {warnings} هشدار',
  'redirects.import.table': 'نتیجهٔ بررسی فایل',
  'redirects.import.col.line': 'سطر',
  'redirects.import.col.from': 'نشانی قدیمی',
  'redirects.import.col.to': 'مقصد',
  'redirects.import.col.outcome': 'نتیجه',
  'redirects.import.col.note': 'توضیح',
  'redirects.import.outcome.new': 'تازه',
  'redirects.import.outcome.update': 'به‌روزرسانی',
  'redirects.import.outcome.unchanged': 'بدون تغییر',
  'redirects.import.outcome.refused': 'رد شد',
  'redirects.import.gone': 'حذف‌شده (۴۱۰)',
  // File-level refusals.
  'redirects.import.empty': 'فایل ردیفی ندارد.',
  'redirects.import.encoding':
    'حروف فایل خوانده نشد، چون فایل با کدگذاری یونی‌کد ذخیره نشده است. در اکسل با «ذخیره به‌عنوان» نوع CSV با کدگذاری یونی‌کد را انتخاب کنید.',
  'redirects.import.unclosedQuote':
    'در سطر {line} یک علامت نقل‌قول (") بسته نشده است. فایل را در صفحه‌گسترده دوباره ذخیره کنید.',
  'redirects.import.tooManyRows':
    'فایل بیش از {max} ردیف دارد. آن را به چند فایل کوچک‌تر تقسیم کنید.',
  'redirects.import.overCap':
    'با این فایل، تغییر مسیرهای فعال به {total} می‌رسد و سقف {max} است. ردیف‌های بی‌استفاده را غیرفعال کنید یا فایل را کوچک‌تر کنید.',
  // Row refusals and warnings.
  'redirects.import.status': 'کد انتقال فقط ۳۰۱ یا ۴۱۰ است.',
  'redirects.import.query':
    'نیاز به نگاشت دستی: نشانی پارامتر دارد (بخش بعد از «?») و سایت فقط مسیر را می‌سنجد. برای مسیر بدون پارامتر یک ردیف جدا بنویسید.',
  'redirects.import.origin': 'دامنهٔ {host} در فهرست دامنه‌های سایت قبلی نیست.',
  'redirects.import.duplicate': 'این نشانی قدیمی در سطر {line} هم آمده است.',
  'redirects.import.notImport':
    'برای این نشانی یک تغییر مسیر دیگر (نه از فایل) ثبت شده است. آن را در همین فهرست ویرایش کنید.',
  'redirects.import.live': 'این نشانی صفحهٔ منتشرشدهٔ سایت است و تغییر مسیر آن را پنهان می‌کند.',
  'redirects.import.deadTarget':
    'هشدار: مقصد صفحهٔ منتشرشده‌ای نیست و بازدیدکننده به صفحهٔ «پیدا نشد» می‌رسد.',
  'redirects.import.manyHome':
    'هشدار: بیش از ۵ ردیف به صفحهٔ خانه می‌رود. گوگل این‌ها را صفحهٔ خطا می‌شمارد؛ مقصد نزدیک‌تری بنویسید.',
  // Endpoint answers.
  'redirects.import.forbidden': 'فقط مدیر می‌تواند نشانی‌ها را از فایل وارد کند.',
  'redirects.import.badRequest': 'درخواست خوانده نشد. صفحه را تازه کنید و دوباره بررسی کنید.',
  'redirects.import.tooLarge': 'فایل بزرگ‌تر از {max} مگابایت است. آن را به چند فایل تقسیم کنید.',
  'redirects.import.changed':
    'از زمان بررسی، تغییر مسیرها یا صفحه‌های سایت عوض شده‌اند. دوباره «بررسی بدون ذخیره» را بزنید.',
  'redirects.import.failed':
    'ثبت در سطر {line} متوقف شد: {reason} {n} ردیف پیش از آن ثبت شد. دوباره بررسی کنید؛ ردیف‌های ثبت‌شده «بدون تغییر» می‌شوند.',
} as const;

export type RedirectsMessageKey = keyof typeof REDIRECTS_MESSAGES;

/** The message with its {placeholders} filled in. */
export function redirectsText(
  key: RedirectsMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return REDIRECTS_MESSAGES[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? ''),
  );
}
