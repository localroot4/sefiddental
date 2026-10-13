import { createHash } from 'node:crypto';

/*
 * Self-contained 503 (maintenance) and 410 (gone) documents. The proxy returns them without
 * rendering React (maintenance must work with the database down), and
 * scripts/sync-public-assets.mjs writes the maintenance copy to public/maintenance.html for the
 * platform to serve while Node is down. Constraints: only node: imports, no relative or '@/'
 * imports, erasable TypeScript only (Node 22 type stripping imports this file directly), no
 * script, no style attribute; the one inline <style> is allowed by its hash.
 */

export type StaticPageKind = 'maintenance' | 'gone';

/** Copy of the static pages; tested for banned words, Arabic letters and em dashes. */
export const STATIC_PAGE_COPY = {
  siteName: 'کلینیک دندانپزشکی سفید',
  callLabel: 'تماس با کلینیک',
  phoneE164: '+982155101054',
  phoneDisplay: '۰۲۱ ۵۵۱۰ ۱۰۵۴',
  hoursLine: 'همه‌روزه ۱۰ تا ۲۰، به‌جز تعطیلات رسمی',
  urgentLabel: 'درد شدید دارید؟',
  urgentHref: '/اورژانس',
  linksHeading: 'صفحه‌های پرکاربرد',
  links: [
    { label: 'خدمات زیبایی دندان', href: '/خدمات/زیبایی' },
    { label: 'جراحی و جایگزینی دندان', href: '/خدمات/جراحی-و-جایگزینی-دندان' },
    { label: 'درمان و نگهداری دندان', href: '/خدمات/درمان-دندان' },
    { label: 'همهٔ خدمات', href: '/خدمات' },
  ],
  maintenance: {
    title: 'در حال به‌روزرسانی',
    heading: 'سایت در حال به‌روزرسانی است',
    lead: 'چند دقیقهٔ دیگر برمی‌گردیم. برای نوبت یا سؤال فوری با کلینیک تماس بگیرید.',
  },
  gone: {
    title: 'این صفحه دیگر در دسترس نیست',
    heading: 'این صفحه دیگر در دسترس نیست',
    lead: 'نشانی این صفحه حذف شده است. از پیوندهای زیر به صفحهٔ مورد نظرتان بروید.',
  },
} as const;

/** Brand lockup without the Latin line (design/brand/logo-lockup-no-latin.svg), path data only. */
export const BRAND_LOCKUP = {
  viewBox: '113.7 82.7 1052.6 280.0',
  wordmarkPath:
    'M412.0 315.8C409.7 315.6 406.6 315.2 405.2 314.9C403.7 314.6 402.1 314.2 401.5 314.1C399.5 313.7 393.3 311.9 391.8 311.3C391.5 311.1 390.3 310.7 389.3 310.3C383.1 308.0 375.5 303.8 370.0 299.7C367.9 298.1 365.8 296.5 365.4 296.2C364.9 295.8 362.8 293.9 360.7 291.9C352.8 284.2 347.9 277.3 343.0 267.3C341.9 265.0 341.0 262.8 341.0 262.6C341.0 262.3 340.9 262.0 340.7 261.8C340.5 261.6 340.1 260.4 339.7 259.2C339.3 257.9 338.8 256.5 338.7 256.2C338.5 255.8 338.2 254.8 338.0 254.0C337.0 250.0 336.8 249.5 336.3 249.4C335.8 249.3 335.7 250.5 335.6 264.4C335.5 277.6 335.4 279.8 334.9 281.5C332.3 290.1 327.0 296.1 318.8 299.4L315.2 300.8L295.5 301.0C284.1 301.1 275.7 301.0 275.4 300.9C275.1 300.6 275.0 295.4 275.0 275.1C275.1 258.2 275.0 249.5 274.7 249.3C274.2 248.7 273.8 249.2 273.2 251.4C271.8 256.5 268.1 264.6 265.3 268.7C264.5 269.9 263.7 271.1 263.5 271.4C260.9 275.7 253.8 282.8 247.5 287.6C245.3 289.2 237.4 294.0 236.9 294.0C236.8 294.0 235.7 294.5 234.4 295.0C231.0 296.6 231.0 296.6 228.2 297.5C224.5 298.6 221.8 299.3 219.8 299.7C218.9 299.9 217.5 300.2 216.7 300.4C215.0 300.8 123.3 301.4 122.3 300.9C121.8 300.7 121.7 298.2 121.8 269.1L121.8 237.5L164.8 237.3C213.1 237.1 208.8 237.4 211.0 234.7C214.0 230.8 212.9 226.2 208.3 223.6C207.6 223.2 200.6 223.1 164.7 223.0L121.8 222.8L121.7 204.5C121.6 185.4 121.8 181.7 123.0 177.8C124.8 171.9 127.4 168.3 133.2 163.7C133.4 163.5 135.0 162.7 136.7 161.9C142.4 159.2 140.9 159.3 179.3 159.4C214.2 159.6 216.4 159.6 221.3 161.0C222.2 161.2 223.4 161.5 224.2 161.7C237.2 165.0 250.7 173.6 259.7 184.2C261.7 186.6 266.0 192.5 266.0 192.8C266.0 192.9 266.6 193.9 267.3 195.1C269.6 199.0 271.9 204.4 273.6 210.3C274.0 211.4 275.0 211.7 275.0 210.6C275.0 210.2 275.1 198.5 275.1 184.6L275.2 159.3L305.3 159.3L335.5 159.3L335.6 185.2C335.6 199.4 335.7 211.2 335.8 211.3C336.3 211.7 337.1 210.2 337.8 207.3C339.6 200.5 344.0 190.2 346.7 186.3C347.1 185.8 347.3 185.3 347.3 185.2C347.3 184.8 350.5 180.3 353.0 177.1C357.2 171.7 363.6 165.3 367.8 162.3C368.7 161.7 369.7 160.9 370.0 160.6C371.5 159.2 378.0 155.3 382.3 153.2C393.4 147.7 404.8 144.8 417.5 144.1C424.1 143.8 436.2 145.0 441.8 146.7C442.4 146.8 444.0 147.3 445.3 147.7C448.1 148.5 451.7 149.7 453.9 150.7C454.7 151.1 455.4 151.3 455.5 151.3C455.7 151.3 460.2 153.5 462.3 154.7C474.4 161.3 485.4 171.5 493.1 183.2C494.9 186.0 498.7 192.9 498.7 193.5C498.7 193.7 498.8 194.0 499.0 194.2C499.8 195.0 503.0 203.7 503.7 207.0C504.1 209.1 505.0 211.3 505.3 211.3C505.5 211.3 505.7 211.2 505.8 211.0C505.9 210.8 506.0 199.1 506.0 185.0C506.0 170.9 506.1 159.3 506.2 159.3C566.1 159.3 934.1 159.4 934.2 159.4C934.3 159.5 934.3 186.3 934.3 219.0C934.3 281.3 934.4 280.2 933.0 284.0C932.3 285.8 930.7 288.7 929.2 290.7C925.9 295.2 922.3 297.7 915.5 300.2C913.9 300.8 907.5 300.8 723.3 301.0C618.6 301.1 531.4 301.1 529.7 300.9C526.1 300.6 524.3 300.1 520.5 298.3C514.0 295.2 509.2 289.4 506.9 282.0C506.3 280.0 506.2 278.8 506.0 264.5C505.9 253.8 505.7 249.2 505.5 249.1C505.1 249.0 504.3 250.9 503.8 252.8C503.5 254.3 501.6 260.5 501.3 260.8C501.2 261.0 500.8 261.9 500.5 262.8C499.8 264.8 496.5 271.6 495.3 273.5C490.8 281.0 486.5 286.5 480.8 292.1C462.8 309.6 437.3 318.4 412.0 315.8ZM282.5 347.3L275.2 340.0L282.5 332.7C286.5 328.6 289.9 325.3 290.0 325.3C290.3 325.3 304.5 339.7 304.5 340.0C304.5 340.3 290.4 354.7 290.0 354.7C289.9 354.7 286.5 351.4 282.5 347.3ZM313.2 347.3L305.8 340.0L313.2 332.7C317.2 328.6 320.6 325.3 320.7 325.3C320.9 325.3 333.5 337.9 335.3 339.9C335.5 340.0 321.0 354.7 320.7 354.7C320.6 354.7 317.2 351.4 313.2 347.3ZM428.7 238.1C432.9 233.9 436.3 230.4 436.3 230.2C436.3 229.7 421.0 214.6 420.7 214.7C419.9 215.0 405.3 229.9 405.4 230.3C405.5 230.8 420.4 245.7 420.8 245.7C421.0 245.7 424.6 242.3 428.7 238.1ZM413.4 112.9C409.5 109.0 406.3 105.6 406.3 105.3C406.3 104.8 420.3 90.7 420.8 90.7C421.3 90.7 435.4 105.0 435.3 105.3C435.1 105.7 421.0 120.0 420.7 120.0C420.6 120.0 417.3 116.8 413.4 112.9Z',
  markPath:
    'M990.5 333.7C990.4 333.5 990.4 333.4 990.6 333.4C990.7 333.5 990.8 333.3 990.8 333.2C990.8 333.0 990.7 332.9 990.6 332.9C990.4 333.0 990.3 332.7 990.3 332.2C990.2 318.1 990.4 164.2 990.5 163.1C991.1 157.8 993.6 150.9 996.4 146.7C996.9 145.9 997.3 145.2 997.3 145.1C997.3 145.0 998.0 144.0 998.9 142.9C1000.9 140.3 1004.6 136.6 1007.0 135.1C1010.4 132.7 1011.0 132.3 1013.1 131.3C1014.2 130.7 1015.4 130.1 1015.7 130.0C1018.0 128.8 1023.4 127.5 1027.7 127.0C1032.4 126.5 1083.2 126.5 1083.5 127.1C1083.7 127.3 1083.6 127.3 1083.4 127.2C1082.9 126.9 1081.8 127.9 1082.1 128.3C1082.3 128.4 1082.5 128.3 1082.7 128.0C1082.9 127.7 1083.0 127.6 1083.0 127.8C1083.0 128.0 1078.6 135.6 1077.7 137.0C1077.5 137.3 1077.1 137.9 1076.9 138.3C1076.5 139.1 1074.3 142.9 1073.7 144.0C1073.5 144.3 1072.9 145.2 1072.5 146.2C1072.0 147.1 1071.3 148.2 1071.0 148.7C1070.7 149.1 1069.9 150.3 1069.4 151.3C1068.0 153.6 1065.7 157.7 1065.3 158.3C1062.4 163.3 1059.5 168.3 1058.7 169.8C1058.1 170.9 1057.2 172.5 1056.6 173.3C1056.1 174.1 1055.7 174.9 1055.7 175.2C1055.7 175.4 1055.5 175.7 1055.4 175.7C1055.2 175.7 1054.9 176.1 1054.7 176.6C1054.5 177.1 1053.4 179.0 1052.3 180.8C1049.6 185.4 1049.6 185.3 1048.4 187.2C1046.6 190.0 1045.9 192.2 1047.0 191.5C1047.3 191.3 1057.9 177.3 1060.2 174.0C1060.9 173.0 1062.0 171.4 1062.7 170.5C1064.5 168.3 1070.2 160.7 1071.7 158.5C1073.2 156.4 1078.3 149.6 1082.2 144.5C1085.5 140.1 1089.6 136.0 1092.9 133.9C1095.6 132.1 1101.1 129.4 1102.6 129.1C1103.2 129.0 1103.8 128.8 1103.9 128.6C1104.0 128.5 1104.4 128.3 1104.8 128.3C1105.2 128.3 1106.2 128.1 1107.0 127.8C1110.4 126.6 1121.5 126.6 1125.8 127.8C1130.6 129.1 1131.8 129.6 1134.7 131.0C1136.4 131.9 1138.8 133.2 1140.0 134.0C1141.1 134.8 1142.4 135.7 1142.8 135.9C1143.2 136.1 1144.8 137.7 1146.4 139.4C1150.8 144.0 1153.8 148.8 1155.8 154.5C1156.5 156.3 1157.0 158.2 1157.0 158.7C1157.0 159.2 1157.1 159.7 1157.3 159.8C1158.2 160.9 1158.3 169.9 1158.3 250.8C1158.3 332.5 1158.3 333.3 1157.7 333.7C1157.2 333.9 1152.7 334.0 1143.8 333.9C1131.6 333.8 1130.3 333.7 1128.3 333.1C1123.3 331.5 1118.4 328.0 1115.4 323.8C1114.9 323.0 1113.5 321.2 1112.3 319.6C1111.2 318.1 1107.1 312.7 1103.3 307.7C1099.6 302.6 1096.2 298.1 1095.8 297.6C1095.5 297.1 1094.1 295.3 1092.8 293.6C1091.5 291.9 1090.3 290.2 1090.0 289.8C1089.7 289.4 1087.8 286.9 1085.7 284.2C1081.0 277.9 1080.0 276.5 1080.0 275.8C1080.0 275.4 1080.5 274.4 1081.2 273.4C1081.8 272.4 1082.3 271.6 1082.3 271.5C1082.3 271.4 1083.2 270.0 1084.2 268.3C1085.2 266.6 1086.2 264.9 1086.3 264.7C1086.5 264.1 1089.0 259.9 1090.7 257.2C1091.2 256.5 1092.0 255.1 1092.5 254.1C1092.9 253.2 1093.9 251.5 1094.6 250.4C1095.3 249.4 1096.8 247.0 1097.9 245.1C1098.9 243.2 1100.1 241.2 1100.4 240.7C1100.7 240.2 1101.2 239.5 1101.4 239.0C1103.4 235.6 1108.2 227.3 1108.7 226.6C1109.1 226.1 1109.3 225.6 1109.3 225.5C1109.3 225.4 1109.7 224.7 1110.2 223.9C1111.7 221.6 1111.8 221.5 1112.8 219.6C1114.3 217.0 1114.4 216.7 1113.8 216.7C1113.4 216.7 1111.3 219.2 1107.8 224.0C1107.4 224.6 1106.2 226.1 1105.3 227.3C1104.4 228.5 1103.4 229.8 1103.1 230.2C1102.2 231.5 1098.5 236.4 1097.3 238.0C1096.7 238.9 1095.2 240.8 1094.1 242.4C1092.9 243.9 1091.6 245.6 1091.2 246.1C1090.8 246.7 1090.2 247.5 1089.8 248.0C1089.4 248.4 1088.7 249.5 1088.1 250.2C1087.6 251.0 1086.3 252.8 1085.2 254.2C1082.6 257.6 1081.9 258.6 1080.8 260.1C1080.4 260.8 1079.7 261.6 1079.4 261.9C1079.1 262.3 1078.4 263.1 1077.9 263.8C1077.5 264.6 1076.8 265.5 1076.5 265.8C1075.7 266.9 1074.2 268.8 1073.5 269.8C1071.9 272.1 1067.6 277.8 1067.1 278.3C1066.6 278.9 1062.3 284.7 1060.0 287.8C1059.2 289.0 1057.6 291.1 1056.5 292.5C1055.4 293.8 1053.9 295.8 1053.2 296.9C1052.4 297.9 1051.1 299.6 1050.3 300.6C1049.5 301.6 1048.4 303.1 1047.9 303.8C1047.3 304.9 1044.9 308.1 1043.4 309.8C1043.2 310.0 1042.5 311.0 1041.8 312.0C1041.1 313.0 1039.9 314.6 1039.2 315.6C1037.0 318.4 1036.2 319.3 1035.2 320.8C1031.9 325.4 1030.1 327.4 1027.6 329.3C1025.4 330.9 1024.3 331.5 1020.8 332.8L1018.2 333.8L1004.4 333.9C995.2 334.0 990.6 333.9 990.5 333.7Z',
} as const;

// Token values from design/tokens.css (light, then dark under the system preference).
const STYLE = [
  '@font-face{font-family:"Vazirmatn";src:url("/fonts/Vazirmatn-wght.woff2") format("woff2");font-weight:400 700;font-display:swap}',
  '@font-face{font-family:"Estedad";src:url("/fonts/Estedad-Bold.woff2") format("woff2");font-weight:700;font-display:swap}',
  ':root{color-scheme:light dark;--surface:#F7F8F7;--ink:#0A243F;--muted:#4A5C70;--line:#D9E0E0;--brand:#007A72;--brand-strong:#00655F;--on-brand:#FFFFFF;--warning:#A85012;--focus:#007A72}',
  '@media (prefers-color-scheme:dark){:root{--surface:#071A2B;--ink:#EAF1F4;--muted:#A9B8C6;--line:#1E3A52;--brand:#2BB5AA;--brand-strong:#5FD0C6;--on-brand:#071A2B;--warning:#F0A05A;--focus:#5FD0C6}}',
  '*{box-sizing:border-box}',
  'html{background:var(--surface);color:var(--ink);-webkit-text-size-adjust:100%}',
  'body{margin:0;min-height:100dvh;display:flex;align-items:center;background:var(--surface);color:var(--ink);font:400 1rem/1.85 "Vazirmatn",system-ui,sans-serif}',
  'main{width:100%;max-width:36rem;margin:0 auto;padding:3rem 1rem}',
  '.logo{display:block;width:11rem;height:auto;margin-block-end:2.5rem;color:var(--ink)}',
  'h1{margin:0 0 1rem;font:700 clamp(1.75rem,1.2rem + 2.2vw,3rem)/1.2 "Estedad","Vazirmatn",system-ui,sans-serif}',
  'p{margin:0}',
  '.lead{max-width:62ch;color:var(--muted);font-size:1.125rem;line-height:1.9}',
  '.call{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1rem;margin-block-start:2rem}',
  '.btn{display:inline-flex;align-items:center;min-height:44px;padding-inline:1.25rem;border-radius:999px;background:var(--brand);color:var(--on-brand);font-weight:700;text-decoration:none;transition:background-color .2s cubic-bezier(.16,1,.3,1)}',
  '.btn:hover{background:var(--brand-strong)}',
  '.num{font-weight:700}',
  '.hours{flex-basis:100%;color:var(--muted);font-size:.875rem;line-height:1.7}',
  'nav{margin-block-start:2.5rem}',
  'h2{margin:0 0 .5rem;color:var(--muted);font-size:.875rem;font-weight:400}',
  'ul{list-style:none;margin:0;padding:0;border-block-start:1px solid var(--line)}',
  'li a{display:flex;align-items:center;min-height:48px;border-block-end:1px solid var(--line);color:var(--ink);text-decoration:none}',
  'li a:hover{color:var(--brand)}',
  '.urgent{display:inline-flex;align-items:center;min-height:44px;margin-block-start:1.5rem;color:var(--warning);font-weight:700}',
  '[dir=ltr]{unicode-bidi:isolate}',
  'a:focus-visible{outline:none;border-radius:4px;box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--focus)}',
  '@media (min-width:744px){main{padding:4rem 1.5rem}}',
  '@media (prefers-reduced-motion:reduce){.btn{transition:none}}',
].join('');

/** base64 SHA-256 of the inline style, for `style-src 'sha256-…'` here and in the page CSP. */
export const STATIC_PAGE_STYLE_SHA256 = createHash('sha256').update(STYLE).digest('base64');

/** CSP for the static documents: no script at all, the one style by hash, same-origin fonts. */
export const STATIC_PAGE_CSP = [
  "default-src 'none'",
  `style-src 'sha256-${STATIC_PAGE_STYLE_SHA256}'`,
  "font-src 'self'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const logo = () =>
  `<svg class="logo" viewBox="${BRAND_LOCKUP.viewBox}" role="img" aria-label="${STATIC_PAGE_COPY.siteName}">` +
  `<path fill="currentColor" fill-rule="evenodd" d="${BRAND_LOCKUP.wordmarkPath}"/>` +
  `<path fill="#00827A" fill-rule="evenodd" d="${BRAND_LOCKUP.markPath}"/></svg>`;

const call = () =>
  '<div class="call">' +
  `<a class="btn" href="tel:${STATIC_PAGE_COPY.phoneE164}">${STATIC_PAGE_COPY.callLabel}</a>` +
  `<span class="num" dir="ltr">${STATIC_PAGE_COPY.phoneDisplay}</span>` +
  `<p class="hours">${STATIC_PAGE_COPY.hoursLine}</p>` +
  '</div>';

const links = () =>
  `<nav aria-labelledby="links-heading"><h2 id="links-heading">${STATIC_PAGE_COPY.linksHeading}</h2><ul>` +
  STATIC_PAGE_COPY.links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('') +
  `</ul></nav><a class="urgent" href="${STATIC_PAGE_COPY.urgentHref}">${STATIC_PAGE_COPY.urgentLabel}</a>`;

/**
 * Complete UTF-8 document. Maintenance has no site links: they would answer 503 too (spec C9).
 */
export function renderStaticSystemPage(kind: StaticPageKind): string {
  const copy = STATIC_PAGE_COPY[kind];
  return (
    '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<meta name="color-scheme" content="light dark">' +
    `<title>${copy.title} | ${STATIC_PAGE_COPY.siteName}</title>` +
    '<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">' +
    `<style>${STYLE}</style></head><body><main>` +
    logo() +
    `<h1>${copy.heading}</h1><p class="lead">${copy.lead}</p>` +
    call() +
    (kind === 'gone' ? links() : '') +
    '</main></body></html>'
  );
}
