import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeHero } from './HomeHero';

// The booking island's data readers need Payload; the order tests need only its place.
vi.mock('@/components/booking/BookingForm', () => ({ BookingForm: () => <form /> }));
// The placeholder captions show on the client preview only (DEMO_CONTENT).
const env = vi.hoisted(() => ({ demoContent: false }));
vi.mock('@/lib/env', () => ({ readEnv: () => ({ demoContent: env.demoContent }) }));
function preview(on: boolean): void {
  env.demoContent = on;
  vi.stubEnv('DEMO_CONTENT', on ? '1' : '');
}
afterEach(() => {
  preview(false);
  vi.unstubAllEnvs();
});

const set = { avif: 'a.avif 800w', other: 'a.webp 800w', otherType: 'image/webp' };

function render(placeholder: boolean, intro?: React.ReactNode): string {
  return renderToStaticMarkup(
    <HomeHero
      title="عنوان"
      subtext="زیرعنوان"
      image={{
        wide: set,
        tall: set,
        img: { src: '/a.webp', width: 800, height: 1000, alt: 'عکس' },
        preloadHref: '/a.avif',
        placeholder,
      }}
      relief
      phone="+982100000000"
      facts={[{ value: 'یک' }]}
      intro={intro}
    />,
  );
}

describe('home hero markup', () => {
  it('HH1 the scrim (H1 and subtext) comes before the photo in the streamed HTML', () => {
    const html = render(false);
    // A first frame that holds only the photo paints it under the header on phones (LCP, shift).
    expect(html.indexOf('id="hero-h1"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="hero-sub"')).toBeLessThan(html.indexOf('<picture'));
    expect(html.indexOf('id="hero-h1"')).toBeLessThan(html.indexOf('<picture'));
  });

  it('HH2 the trust band is the world window after the clipped photo wrapper, in the server HTML (D18)', () => {
    const html = render(true);
    const photo = html.indexOf('data-hero-photo=""');
    const band = html.indexOf('data-scene="trust"');
    expect(photo).toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(photo);
    expect(html.slice(band)).toContain('data-world-slot="hero-exit"');
    expect(html.slice(band)).toContain('lg:min-h-[40svh]');
    // The band leaves the photo's bounds: it is outside the clipping wrapper.
    const wrapper = html.indexOf('lg:overflow-clip');
    expect(wrapper).toBeLessThan(photo);
    // From 1024 px the sunken surface is the wrapper's, in its own stacking context (under the
    // photo), and the section is transparent: the band shows the page surface.
    expect(html.slice(0, wrapper)).toContain('lg:bg-transparent');
    const wrapperClass = html.slice(html.lastIndexOf('class="', wrapper), wrapper);
    expect(wrapperClass).toContain('lg:isolate');
    expect(html.slice(wrapper, wrapper + 40)).toContain('lg:bg-surface-sunken');
    expect(html).not.toContain('style=');
  });

  it('HH3 the settle is keyed on html[data-intro] with 60 ms steps by position; no opacity on the H1 (D11)', () => {
    // Static markup escapes the `&` of the arbitrary variants.
    const html = render(true).replace(/&amp;/g, '&');
    const h1 = html.slice(html.indexOf('<h1'), html.indexOf('</h1>'));
    expect(h1).toContain('[html[data-intro=playing]_&]:translate-y-[12px]');
    expect(h1).toContain('[html[data-intro=done]_&]:translate-y-0');
    expect(h1).not.toContain('opacity');
    expect(h1).not.toContain('delay-');
    const sub = html.slice(html.indexOf('id="hero-sub"'), html.indexOf('</p>'));
    expect(sub).toContain('[html[data-intro=done]_&]:delay-[60ms]');
    expect(html).toContain('[html[data-intro=done]_&]:delay-[120ms]');
  });

  it('HH4 the mark relief renders on a real photo only (D3)', () => {
    expect(render(true)).not.toContain('#mark"');
    expect(render(false)).toContain('#mark"');
  });

  it('HH5 the intro script comes right after the first row (H1 block, booking card), before the photo', () => {
    const html = render(true, <script id="intro-script" />);
    // The parser yields after that script: what is parsed before it paints in the first frame,
    // and a card arriving a frame after the H1 block would re-centre it from 744 px.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const row = doc.getElementById('hero-h1')?.parentElement?.parentElement;
    expect(doc.getElementById('intro-script')?.previousElementSibling).toBe(row);
    expect(row?.querySelector('#hero-sub')).not.toBeNull();
    expect(row?.querySelector('form')).not.toBeNull();
    expect(row?.lastElementChild?.tagName).toBe('FORM');
    expect(html.indexOf('id="intro-script"')).toBeLessThan(html.indexOf('data-hero-photo'));
  });

  it('HH6 the placeholder captions show on the client preview only (DEMO_CONTENT)', () => {
    expect(render(true)).not.toContain('جای عکس');
    preview(true);
    expect(render(true).match(/جای عکس/g)).toHaveLength(2);
    expect(render(false)).not.toContain('جای عکس');
  });
});

describe('phone spec rule 2.2-11', () => {
  it('U-PH16 the home components and the site CSS size nothing in dvh or bare vh (svh or lvh only)', () => {
    // Under the experience root a dvh or vh box resizes as the phone toolbar hides, after the
    // triggers measured it; comments may still name the units.
    const dir = path.resolve('src/components/home');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => path.join(dir, file));
    const offenders = [...files, path.resolve('src/app/globals.css')].flatMap((file) =>
      readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .split('\n')
        .filter((line) => /\d(?:\.\d+)?d?vh\b|\bh-dvh\b/.test(line))
        .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
