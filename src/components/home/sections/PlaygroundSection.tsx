import { QualityControl } from '@/components/home/QualityControl';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';

/**
 * The six lockup parts at home, as logical positions in the field. From 1024 px prototype 0e: the
 * mark at the start side, the bar beside it, the four diamonds clustered at the bar's end. Under
 * 1024 px (phone spec scene 11) they rest as a pile on the inline-end half (the left in RTL): the
 * bar on the floor, the mark standing on it at the end edge, the diamonds in a column beside the
 * mark; the inline-start half, under the right thumb, holds no part, so a swipe there scrolls the
 * page. The pile spans 4% + 132 px, inside half of a 320 px field. Every part is at least 44 px
 * (BR5: the bar's box keeps that height at every width; its artwork stays centred); the mark's
 * svg fills its box, the bar's too, a diamond sits centred in its 48 px hit area (44 px under
 * 1024 px). Whole class strings only, from the token scale (globals.css resets Tailwind's
 * spacing: `bottom-11` would be no CSS at all): Tailwind reads them from the source, so an
 * interpolated name generates no CSS either.
 */
const PARTS: readonly { part: string; box: string; svg: string }[] = [
  {
    part: 'mark',
    box: 'end-[4%] bottom-[44px] h-[90px] w-[72px] lg:start-[4%] lg:end-auto lg:bottom-0 lg:h-[120px] lg:w-[96px]',
    svg: 'size-full',
  },
  {
    part: 'bar',
    box: 'end-[4%] bottom-0 min-h-target h-target w-[132px] lg:start-[calc(4%+120px)] lg:end-auto lg:bottom-2 lg:h-[calc(min(44vw,260px)/3)] lg:w-[min(44vw,260px)]',
    svg: 'size-full',
  },
  {
    part: 'diamond-1',
    box: 'end-[calc(4%+76px)] bottom-[44px] size-target lg:start-[calc(4%+124px+min(44vw,260px))] lg:end-auto lg:bottom-2 lg:size-12',
    svg: 'size-6',
  },
  {
    part: 'diamond-2',
    box: 'end-[calc(4%+76px)] bottom-[88px] size-target lg:start-[calc(4%+156px+min(44vw,260px))] lg:end-auto lg:bottom-[44px] lg:size-12',
    svg: 'size-6',
  },
  {
    part: 'diamond-3',
    box: 'end-[calc(4%+76px)] bottom-[132px] size-target lg:start-[calc(4%+188px+min(44vw,260px))] lg:end-auto lg:bottom-2 lg:size-12',
    svg: 'size-6',
  },
  {
    part: 'diamond-4',
    box: 'end-[calc(4%+76px)] bottom-[176px] size-target lg:start-[calc(4%+156px+min(44vw,260px))] lg:end-auto lg:bottom-[80px] lg:size-12',
    svg: 'size-6',
  },
];

/**
 * Scene 11, the footer playground and the «کیفیت» control (phase 7 report D9, D15): the last
 * child inside `ExperienceRoot`, `data-scene="footer"`, no `data-home-section`, styled as the
 * footer's top band. Server markup only: the header line the parts drop from, the field with the
 * six lockup parts (`<use>` of the sprite in `page.tsx`, `aria-hidden`: pointer toys), then the
 * control and «پخش دوباره» (the keyboard path; its box is there at every tier, invisible and
 * inert until scenes/dom/footer.ts shows it at tiers 1 to 3, D24). The parts are `touch-action: none`, the field is not, so the page still
 * scrolls on it; the field is `min(52svh, 440px)` tall, shorter on phones, so a part under the
 * thumb never blocks the scroll path. Tier 0 and reduced motion: this HTML, static, no chunk.
 */
export function PlaygroundSection() {
  return (
    <div data-scene="footer" className="overflow-clip bg-surface-sunken">
      <div className="mx-auto grid w-full max-w-content gap-6 px-gutter pt-8 pb-8">
        <div className="h-[2px] rounded-pill bg-brand opacity-35" aria-hidden="true" />
        <div
          data-playground-field=""
          data-world-slot="playground"
          aria-hidden="true"
          className="relative h-[min(52svh,440px)] border-b border-line-strong"
        >
          {PARTS.map(({ part, box, svg }) => (
            <div
              key={part}
              data-playground-part={part}
              className={cx(
                'absolute grid touch-none place-items-center select-none',
                part === 'mark' ? 'text-brand' : 'text-ink',
                box,
              )}
            >
              <svg className={cx('pointer-events-none block', svg)} fill="currentColor">
                <use href={`#lockup-${part}`} />
              </svg>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <QualityControl
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
          <Button variant="secondary" data-playground-replay="" inert className="invisible">
            {t('home.playground.replay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
