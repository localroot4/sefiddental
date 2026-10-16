/**
 * Persian UI strings of the emergency page /اورژانس (docs/conversion.md 7, phase 5 emergency
 * spec); merged into MESSAGES in src/i18n/fa.ts. Strings of conversion.md 7 are verbatim; the
 * clinic number in a message is a separate LTR island between a `before` and an `after` part.
 * DRAFT marks studio copy the client approves at the phase 5 hand-off.
 */
export const EMERGENCY_MESSAGES = {
  // 7.1 leads. Closing soon keeps the first sentence only: no same-day promise (EM-D1).
  'emergency.lead.open':
    'در ساعات کاری، سریع‌ترین راه تماس تلفنی است. در صورت امکان همان روز نوبت می‌دهیم.',
  'emergency.lead.closingSoon': 'در ساعات کاری، سریع‌ترین راه تماس تلفنی است.',
  'emergency.lead.closed':
    'کلینیک الان بسته است. اگر یکی از نشانه‌های کادر زیر را دارید، منتظر نمانید. در غیر این صورت شماره‌تان را بگذارید.',

  // 7.2 safety box; «اورژانس ۱۱۵» is the tel:115 link inside the heading (EM-B2).
  'emergency.safety.before': 'اگر یکی از این‌ها را دارید، همین حالا با',
  'emergency.safety.link': 'اورژانس ۱۱۵',
  'emergency.safety.after': 'تماس بگیرید یا به اورژانس نزدیک‌ترین بیمارستان بروید:',
  'emergency.safety.face': 'ورم صورت به چشم یا گردن رسیده یا چشم باز نمی‌شود.',
  'emergency.safety.breath': 'نفس کشیدن، قورت دادن، حرف زدن یا باز کردن دهان سخت شده است.',
  'emergency.safety.bleeding': 'خونریزی دهان زیاد است و با ۱۵ دقیقه فشار مداوم بند نمی‌آید.',
  'emergency.safety.head': 'ضربهٔ شدیدی به سر یا صورت خورده‌اید.',
  'emergency.safety.sameDay':
    'اگر ورم با تب، لرز یا حال عمومی بد همراه است، همین امروز باید معاینه شوید. اگر کلینیک بسته است، به اورژانس بیمارستان بروید.',

  // 7.3 triage and form. The form heading is DRAFT; the intro is 7.1 item 5.
  'emergency.form.heading': 'درخواست فوری',
  'emergency.form.intro': 'اگر تماس برقرار نشد، شماره‌تان را بگذارید.',
  'emergency.triage.legend': 'کدام مورد دربارهٔ شما درست است؟',
  'emergency.triage.severe_pain': 'درد شدیدی که با مسکن آرام نمی‌شود',
  'emergency.triage.swelling': 'ورم لثه یا صورت',
  'emergency.triage.broken': 'دندان شکسته یا ضربه به دندان',
  'emergency.triage.avulsion': 'دندانی که کامل از جا درآمده است',
  'emergency.triage.bleeding': 'خونریزی کم بعد از کشیدن دندان که هنوز ادامه دارد',
  'emergency.triage.required':
    'یکی از موارد را انتخاب کنید. اگر هیچ‌کدام درست نیست، نوبت عادی بگیرید.',
  'emergency.none.before': 'هیچ‌کدام؟ برای درد خفیف یا مشکل غیرفوری،',
  'emergency.none.link': 'نوبت عادی بگیرید',
  'emergency.avulsion.text':
    'اگر دندان دائمی است، هر دقیقه مهم است. دندان را از تاج بگیرید و به ریشه دست نزنید. اگر کثیف است، حداکثر ۱۰ ثانیه با آب سرد روان بشویید و آن را نسابید. اگر می‌توانید، همین حالا دندان را در جای خودش بگذارید و روی دستمال تمیز گاز بگیرید. اگر نمی‌توانید، آن را در شیر نگه دارید، نه در آب. دندان شیری را در جایش نگذارید.',
  'emergency.avulsion.open': 'همین حالا با کلینیک تماس بگیرید و راه بیفتید.',
  'emergency.avulsion.closed':
    'کلینیک الان بسته است. هرچه زودتر به نزدیک‌ترین درمانگاه دندانپزشکی شبانه‌روزی یا اورژانس بیمارستان بروید.',
  'emergency.submit': 'ثبت درخواست فوری',
  // DRAFT: the name limit of bookings (80); the note's message pattern.
  'emergency.nameTooLong': 'نام بیشتر از ۸۰ حرف است. آن را کوتاه‌تر کنید.',

  // conversion.md 5.2 messages quoting this form's button (conflict C3, EM-F13).
  'emergency.failed.expired':
    'صفحه مدت زیادی باز مانده بود و درخواست ثبت نشد. دوباره «ثبت درخواست فوری» را بزنید.',
  'emergency.failed.retry': 'درخواست هنوز ثبت نشده است. یک بار دیگر «ثبت درخواست فوری» را بزنید.',
  'emergency.failed.network':
    'ارسال انجام نشد. اتصال اینترنت را بررسی کنید و دوباره «ثبت درخواست فوری» را بزنید. اگر باز هم نشد، با',
  'emergency.failed.server':
    'مشکلی در سایت پیش آمد و درخواست ثبت نشد. دوباره «ثبت درخواست فوری» را بزنید یا با',
  // 7.3: a second emergency from one phone in 24 hours (an info state, not an error).
  'emergency.repeat.before':
    'امروز یک درخواست فوری با این شماره ثبت شده است. پذیرش با شما تماس می‌گیرد. اگر حالتان بدتر شده، در ساعات کاری با',
  'emergency.repeat.after': 'تماس بگیرید یا به اورژانس بیمارستان بروید.',

  // 7.3 success; the generic line stands in when the answer carries no callback line.
  'emergency.done': 'درخواست فوری شما ثبت شد.',
  'emergency.done.callbackGeneric': 'پذیرش در ساعات کاری با شما تماس می‌گیرد.',

  // 7.4 self-care slot heading (DRAFT); the block itself is Payload content, phase 6.
  'emergency.selfCare.heading': 'تا زمان معاینه',
} as const;
