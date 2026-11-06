# Admin panel UI

The look of the Payload admin at `ADMIN_ROUTE` (`/giris`): the theme layer, the dashboard view,
and what was verified. Files:

- `src/app/(payload)/custom.scss`: the theme layer (tokens and Payload overrides).
- `src/admin/views/Dashboard.tsx` and `Dashboard.module.css`: the dashboard view.
- `src/admin/dashboard.ts`: the greeting, the seven-day trend and the quick actions (pure logic).
- `src/admin/components/BookingsTrend.tsx`: the trend panel.
- `src/admin/bookings/bookings.module.css` (`.today`, `.figures`) and
  `src/admin/components/dashboard.module.css`: the shared panel, the KPI strip, lists, links, the
  error state and the trend chart.

## 1. Design intent

Operate mode: the public site's teal and navy-tinted neutrals on calm raised panels, red only for
danger, green only for success, Vazirmatn, one type scale and one spacing scale on Payload's
`--base` (20 px at a 13 px root).

## 2. Tokens

All tokens live in `custom.scss`. Payload's CSS sits in `@layer payload-default`; these rules are
unlayered, so they win without `!important`.

### 2.1 Neutral ramp

Payload derives every `--theme-elevation-*` from `--color-base-*`, and flips the mapping in dark
(`--theme-elevation-0` is `--color-base-900` there). One ramp therefore re-tints both themes. The
anchors come from `design/tokens.css`; the steps between them are OKLab interpolations.

| Step | Value | Light use | Dark use |
|---|---|---|---|
| 0 | `#ffffff` | page, panels, inputs | text |
| 50 | `#f4f7f7` | navigation rail, row tint | |
| 150 | `#d9e0e1` | hairlines | |
| 250 | `#a9b8c6` | | muted text |
| 400 | `#7b8a9a` | field borders, trend bars | |
| 450 | `#718191` | | field borders, trend bars |
| 650 | `#4a5c70` | muted text, group headings | |
| 750 | `#1e3a52` | | hairlines |
| 800 | `#0f2c45` | text | |
| 850 | `#0b2338` | | panels |
| 900 | `#071a2b` | | page |
| 950 | `#04121f` | | navigation rail, sign-in surface |

### 2.2 Admin tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--admin-brand` | `#007a72` | `#2bb5aa` | primary buttons, focus ring, active nav bar, today's trend bar |
| `--admin-brand-strong` | `#00655f` | `#5ccbc1` | button hover, links, active nav text |
| `--admin-brand-soft` | `#ecf6f4` | `#0f3b3a` | active nav pill, hover of quick actions, sign-in surface (light) |
| `--admin-on-brand` | `#ffffff` | `#071a2b` | text on brand fills |
| `--admin-warning` / `-soft` | `#a85012` / `#fbefe4` | `#f0a05a` / `#3a2614` | emergency and overdue (urgency, not error) |
| `--admin-danger` / `-soft` | `#c81e2e` / `#fdecec` | `#ff6b6b` / `#3b1a1f` | a panel that failed to read |
| `--color-success-*` | green ramp, `#2f7a3c` at 650 | flipped by Payload | Payload's success states (its default is blue) |
| `--admin-shadow` | two navy-tinted layers | none | panel elevation; dark separates by surface and hairline |
| `--admin-radius-card` | 16 px | | panels, the sign-in sheet |
| `--admin-radius-control` | 10 px | | quick actions, nav links |
| `--style-radius-s/m/l` | 6 / 10 / 16 px | | Payload's own radii (inputs, cards, pills) |
| `--admin-duration`, `--admin-ease` | 180 ms, `cubic-bezier(0.2, 0, 0, 1)` | | every transition; none under `prefers-reduced-motion` |

### 2.3 Type and spacing

One scale on `--base`: body 13 px (Payload's root), labels and nav links `0.75 × base` (15 px),
panel headings `0.85 × base` (17 px), KPI figures `1.6 × base` (32 px), the greeting
`clamp(1.5rem, 1.1rem + 1.2vw, 2rem)`. Spacing is `0.25`, `0.5`, `0.75`, `1`, `1.25` and `1.5`
times `--base`. Every link and button on the dashboard and in the navigation is at least 44 px
tall.

## 3. Payload surfaces the theme changes

- Primary buttons: brand fill (Payload's disabled state is untouched).
- Fields: a 3:1 border (WCAG 1.4.11; Payload's line colour is 1.3:1), a brand ring on focus. The
  states are excluded on the control itself (`:not(.error *, .date-time-field--has-error *,
  :disabled, [readonly])`), because these unlayered rules beat every Payload rule: a field in error
  keeps Payload's red border at any depth inside rows, groups and arrays (T-AD42), and disabled
  and read-only controls keep Payload's look.
- Navigation: a tinted rail, group headings in small muted type, 44 px links on a rounded pill,
  the current view's link on brand-soft with a 3 px brand bar at its inline start.
- Breadcrumb links in brand-strong.
- Collection cards: white with a hairline, a brand edge and the panel shadow on hover.
- Sign-in, password and TOTP screens (`.template-minimal`): brand-soft surface (light) or the
  deepest navy (dark), the form on one raised sheet with the brand lockup.

## 4. The dashboard

`admin.components.views.dashboard` replaces Payload's dashboard (`beforeDashboard` is gone; G15:
still not the experimental widgets API). Order in the DOM, which is also the order T-AD27 checks:

1. Header: «صبح/ظهر/عصر/شب بخیر، {name}» by the Tehran clock and today's Jalali date
   (`<time datetime="YYYY-MM-DD">`, Tehran), then the quick actions as a `nav`.
2. «درخواست‌های امروز» (BookingsToday): four figures in one hairline strip (new in brand, an
   emergency today tints its figure with the warning tokens, waiting with its overdue note,
   suspicious), the month's «فوری نبود» share and the open emergencies. Six links, as before.
3. «درخواست‌های هفت روز اخیر» (BookingsTrend): the week's total and seven bars, oldest at the
   right, today in brand, each bar labelled with its count; a hidden list gives screen readers one
   line per day.
4. Content calendar, SEO health, content gaps (admins only): unchanged logic.
5. Payload's own collection cards (`CollectionCards` from `@payloadcms/ui/rsc`), under a hairline.

Quick actions (`quickActions` in `dashboard.ts`) follow the navigation: «درخواست‌های منتظر تماس»
(the same list as the «منتظر تماس» figure), «مقالهٔ تازه» when the viewer may create articles,
«تقویم محتوا» for staff, «وضعیت سیستم» for admins. Each target checks its own access, as before.

Layouts:

| Width | Grid |
|---|---|
| under 768 px | one column; quick actions two to a row; KPI strip 2 × 2; collection cards two to a row |
| 768 to 1279 px | six columns: KPI, trend and calendar full width; SEO health and content gaps side by side |
| 1280 px and up | twelve columns: KPI 8 and trend 4; calendar 7 (as tall as its rows) beside SEO health and content gaps 5 |

States of every panel:

- Loading: each widget streams in behind a `Suspense` skeleton of the same frame (grey bars, a
  slow pulse, none under reduced motion). The content gaps skeleton shows for admins only.
- Empty: the panel says so in a sentence («امروز هنوز درخواستی ثبت نشده است.», «در هفت روز اخیر
  درخواستی ثبت نشده است.», and the existing ones).
- Error: «نامشخص: این بخش خوانده نشد. صفحه را دوباره باز کنید.» on the danger tokens; a failed
  count stays «نامشخص», never zero.
- Success: the data.

The trend is one query: `payload.find` on bookings with `select: { createdAt: true }`,
`createdAt >= ` Tehran midnight six days ago (indexed: `bookings_created_at_idx`), real requests
only (the same filter as the counts), `pagination: false`, capped at 2 000 rows, access overridden
after `isVerifiedStaff`, as the other widgets do (DB6 holds the gate). A read that fills the cap
shows «نامشخص», never a low count. Days are bucketed in Asia/Tehran in `trendDays`, from the same
`now` as the header's date.

The panels reveal a moment after the load event (React streams them into hidden containers
first), so e2e rows that read the dashboard wait for no skeleton and no hidden panel
(`dashboardSettled` in `tests/e2e/admin.spec.ts`).

## 5. Measured contrast

WCAG 2.2 ratios, computed from the token values with the sRGB relative luminance formula.

| Pair | Light | Dark |
|---|---|---|
| Text on page | 14.32 | 17.62 |
| Text on panel | 14.32 | 16.01 |
| Muted text on panel | 6.87 | 7.90 |
| Group heading on the nav rail | 6.38 | 9.32 |
| Text on a primary button | 5.22 | 6.96 |
| Text on a hovered primary button | 6.94 | 9.04 |
| Link (brand-strong) on panel | 6.94 | 8.21 |
| Active nav link on its pill | 6.30 | 6.31 |
| Warning figure on its tint | 4.86 | 6.73 |
| Text on the error tint | 12.54 | 15.52 |
| Focus ring (brand) on page, non-text, 3:1 needed | 5.22 | 6.96 |
| Field border on page, non-text, 3:1 needed | 3.53 | 4.41 |
| Trend bar on panel, non-text | 3.53 | 4.00 |
| Today's trend bar on panel | 5.22 | 6.32 |

## 6. Verified

- Unit: `src/admin/dashboard.test.ts` (greeting by the Tehran clock, seven Tehran days, the one
  capped query, a full cap as unknown, quick actions per role); DOM: `dashboard.test.tsx` DB6 (the
  trend's gate) and DB13 (trend states). Each
  was seen failing once against broken code.
- e2e (`admin` project): T-AD41 (greeting and date, four KPI tiles, the trend, quick actions by
  role, axe on the trend, no sideways scroll and 44 px quick actions at 390 px) and T-AD42 (an
  empty required field inside an array keeps Payload's red border) beside the
  existing dashboard rows T-AD9, T-AD16, T-AD18, T-AD21, T-AD27, T-AD33 and T-AD34.
- Screenshots in `docs/qa/admin-ui/`: the dashboard and the sign-in page at 390, 820 and 1440 px,
  light and dark, on the e2e database with a week of sample requests.
