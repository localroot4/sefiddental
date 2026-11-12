import { QualityControlDeferred } from '@/components/home/QualityControlDeferred';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';

/**
 * The six lockup parts at home, as logical positions in the field. From 1024 px prototype 0e: the
 * mark at the start side, the bar beside it, the four diamonds clustered at the bar's end. Under
 * 1024 px (phone spec scene 11) they rest as a pile on the inline-end half (the left in RTL): the
 * bar on the floor, the mark standing on it at the end edge, the diamonds in a column beside the
 * mark; the inline-start half, under the right thumb, holds no part, so a swipe there scrolls the
 * page. The pile spans 4% + 132 px, inside half of a 320 px field, and 220 px of height. From
 * 1024 px the lockup rests at a quiet scale (the mark 90 px tall, the bar 192 px): an object on
 * the footer's floor, not a banner. Every part is at least 44 px (BR5: the bar's box keeps that
 * height at every width; its artwork stays centred); the mark's svg fills its box, the bar's
 * too, a diamond sits centred in its 44 px hit area. Whole class strings only, from the token scale (globals.css resets Tailwind's
 * spacing: `bottom-11` would be no CSS at all): Tailwind reads them from the source, so an
 * interpolated name generates no CSS either.
 */
const PARTS: readonly { part: string; box: string; svg: string }[] = [
  {
    part: 'mark',
    box: 'end-[4%] bottom-[44px] h-[90px] w-[72px] lg:start-[4%] lg:end-auto lg:bottom-0 lg:h-[90px] lg:w-[72px]',
    svg: 'size-full',
  },
  {
    part: 'bar',
    box: 'end-[4%] bottom-0 min-h-target h-target w-[132px] lg:start-[calc(4%+88px)] lg:end-auto lg:bottom-0 lg:h-[64px] lg:w-[192px]',
    svg: 'size-full',
  },
  {
    part: 'diamond-1',
    box: 'end-[calc(4%+76px)] bottom-[44px] size-target lg:start-[calc(4%+288px)] lg:end-auto lg:bottom-0',
    svg: 'size-[1.25rem]',
  },
  {
    part: 'diamond-2',
    box: 'end-[calc(4%+76px)] bottom-[88px] size-target lg:start-[calc(4%+316px)] lg:end-auto lg:bottom-[44px]',
    svg: 'size-[1.25rem]',
  },
  {
    part: 'diamond-3',
    box: 'end-[calc(4%+76px)] bottom-[132px] size-target lg:start-[calc(4%+344px)] lg:end-auto lg:bottom-0',
    svg: 'size-[1.25rem]',
  },
  {
    part: 'diamond-4',
    box: 'end-[calc(4%+76px)] bottom-[176px] size-target lg:start-[calc(4%+316px)] lg:end-auto lg:bottom-[88px]',
    svg: 'size-[1.25rem]',
  },
];

/**
 * Scene 11, the footer playground and the «کیفیت جلوه‌ها» control (phase 7 report D9, D15;
 * docs/experience/footer.md): the last child inside `ExperienceRoot`, `data-scene="footer"`, no
 * `data-home-section`. It opens the footer: the same dark ground (`data-theme="dark"`, as
 * SiteFooter), no band edge between them, so the two read as one section. Server markup only: the
 * field with the six lockup parts (`<use>` of the sprite in `page.tsx`, `aria-hidden`: pointer
 * toys) standing on a lit horizon, then the control and a quiet «پخش دوباره» at the floor's edge
 * (the keyboard path; its box is there at every tier, invisible and inert until
 * scenes/dom/footer.ts shows it at tiers 1 to 3, D24). The parts are `touch-action: none`, the
 * field is not, so the page still scrolls on it; the field is 220 px tall on phones (the pile's
 * height), 240 px on tablets and 320 px from 1024 px: room for a throw, and the scroll the
 * courier needs from the booking dock to land here (journey travel minimum, pose.ts). Tier 0 and
 * reduced motion: this HTML, static, the parts at rest on the floor, no chunk.
 */
export function PlaygroundSection() {
  return (
    <div data-scene="footer" data-theme="dark" className="overflow-clip bg-surface-sunken text-ink">
      <div className="mx-auto grid w-full max-w-content gap-4 px-gutter pt-12 pb-12 lg:pt-16">
        <div
          data-playground-field=""
          data-world-slot="playground"
          aria-hidden="true"
          className="relative h-[220px] md:h-[240px] lg:h-[320px]"
        >
          <div className="playground-glow pointer-events-none absolute inset-0" />
          <div className="playground-floor pointer-events-none absolute inset-x-0 bottom-0" />
          {PARTS.map(({ part, box, svg }) => (
            <div
              key={part}
              data-playground-part={part}
              // D8 of the journey: the courier lands on the mark's home box and hands over.
              data-dock={part === 'mark' ? 'footer' : undefined}
              className={cx(
                'absolute grid touch-none place-items-center select-none',
                // The mark's colour is the courier glaze's (globals.css), so the hand-off shows no jump.
                part !== 'mark' && 'text-ink',
                box,
              )}
            >
              <svg className={cx('pointer-events-none block', svg)} fill="currentColor">
                <use href={`#lockup-${part}`} />
              </svg>
            </div>
          ))}
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-ink-muted">
          <QualityControlDeferred
            labels={{
              legend: t('home.quality.label'),
              auto: t('home.quality.auto'),
              tiers: [
                t('home.quality.tier0'),
                t('home.quality.tier1'),
                t('home.quality.tier2'),
                t('home.quality.tier3'),
              ],
              reducedMotion: t('home.quality.reducedMotion'),
              siteCap: t('home.quality.siteCap'),
              device: t('home.quality.device'),
              saveData: t('home.quality.saveData'),
            }}
          />
          <Button variant="ghost" data-playground-replay="" inert className="invisible">
            {t('home.playground.replay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
