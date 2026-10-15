import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, ButtonLink, IconButton } from './Button';
import { Icon } from './Icon';
import { ICON_SPRITE_HASH } from './icons';
import { TextLink } from './TextLink';

describe('buttons and links (DESIGN.md 3.1-3.3)', () => {
  it('UB1 loading keeps the label, swaps the start icon for the spinner, is busy and inert', () => {
    render(
      <Button loading iconStart={<Icon name="calendar" />}>
        در حال ثبت
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'در حال ثبت' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('data-loading')).toBe(true);
    expect(button.className).toContain('pointer-events-none');
    expect(button.querySelector('use')).toBeNull();
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('UB2 idle: a plain button type, no busy flag, the start icon shown', () => {
    render(<Button iconStart={<Icon name="calendar" />}>رزرو نوبت</Button>);
    const button = screen.getByRole('button', { name: 'رزرو نوبت' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('use')?.getAttribute('href')).toBe(
      `/brand/icons.svg?v=${ICON_SPRITE_HASH}#calendar`,
    );
  });

  it('UB3 a disabled link has no href and aria-disabled, so it cannot be focused or followed', () => {
    const { container } = render(
      <ButtonLink href="/رزرو-نوبت" disabled>
        رزرو نوبت
      </ButtonLink>,
    );
    const link = container.querySelector('a')!;
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    // Without href an <a> is generic, which ignores aria-disabled: the role keeps it a link.
    expect(screen.getByRole('link', { name: 'رزرو نوبت' })).toBe(link);
  });

  it('UB4 tracking attributes follow the CallBlock convention', () => {
    render(
      <ButtonLink href="tel:+982155101054" track={{ event: 'call_click', location: 'hero' }}>
        تماس با کلینیک
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'تماس با کلینیک' });
    expect(link.getAttribute('data-track')).toBe('call_click');
    expect(link.getAttribute('data-location')).toBe('hero');
  });

  it('UB5 icon buttons carry their Persian name; the glyph is hidden from assistive tech', () => {
    render(<IconButton label="بستن منو" icon={<Icon name="close" />} />);
    const button = screen.getByRole('button', { name: 'بستن منو' });
    const svg = button.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('UB6 directional glyphs mirror in RTL, others never', () => {
    const { container } = render(
      <>
        <Icon name="caret-forward" />
        <Icon name="arrow-forward" />
        <Icon name="phone" />
        <Icon name="play" />
      </>,
    );
    const classes = [...container.querySelectorAll('svg')].map((svg) =>
      svg.getAttribute('class')!.includes('rtl:-scale-x-100'),
    );
    expect(classes).toEqual([true, true, false, false]);
  });

  it('UB7 text links: an LTR island when asked, the 44 px row when standalone', () => {
    render(
      <>
        <TextLink href="tel:+982155101054" ltr>
          ۰۲۱ ۵۵۱۰ ۱۰۵۴
        </TextLink>
        <TextLink href="/خدمات" standalone>
          همهٔ خدمات
        </TextLink>
      </>,
    );
    expect(screen.getByRole('link', { name: '۰۲۱ ۵۵۱۰ ۱۰۵۴' }).getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('link', { name: 'همهٔ خدمات' }).className).toContain('min-h-target');
    // A named group: hovering an FAQ item or a step around the link must not draw its bar.
    const link = screen.getByRole('link', { name: 'همهٔ خدمات' });
    expect(link.className.split(' ')).toContain('group/link');
    expect(link.className.split(' ')).not.toContain('group');
    expect(link.firstElementChild!.className).toContain('group-hover/link:after:scale-x-100');
  });

  it('UB8 loading without a start icon keeps the width: the 26 px spinner slot comes off the padding', () => {
    render(
      <>
        <Button loading>ثبت</Button>
        <Button loading size="lg">
          ارسال
        </Button>
        <Button loading iconStart={<Icon name="calendar" />}>
          رزرو
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'ثبت' }).className).toContain(
      'ps-[.5625rem] pe-[.5625rem]',
    );
    expect(screen.getByRole('button', { name: 'ارسال' }).className).toContain(
      'ps-[.8125rem] pe-[.8125rem]',
    );
    expect(screen.getByRole('button', { name: 'رزرو' }).className).not.toContain('ps-[');
  });

  it('UB9 the press eases: transitions list `scale`, the property Tailwind 4 scale-* sets', () => {
    render(
      <>
        <Button>رزرو نوبت</Button>
        <IconButton label="بستن منو" icon={<Icon name="close" />} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'رزرو نوبت' }).className).toContain(
      'scale_var(--dur-1)_var(--ease-out)',
    );
    expect(screen.getByRole('button', { name: 'بستن منو' }).className).toContain(
      'transition-[background-color,scale]',
    );
  });
});
