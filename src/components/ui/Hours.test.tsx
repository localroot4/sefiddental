import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ClinicHours } from '@/lib/hoursState';

import { HoursTable, hoursBadgeLabels, hoursRows } from './Hours';
import { HoursBadge } from './HoursBadge';

const week = (weekly: ClinicHours['weekly']): ClinicHours => ({
  timezone: 'Asia/Tehran',
  weekly,
  holidays: [],
  noteFa: '',
});

describe('hours views (address page, booking block)', () => {
  it('UH1 a full week of the same hours is one row «هر روز»', () => {
    const all = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
    expect(hoursRows(week([{ days: [...all], open: '10:00', close: '20:00' }]))).toEqual([
      { days: 'هر روز', hours: '۱۰ تا ۲۰' },
    ]);
  });

  it('UH2 runs of equal days share a row, Saturday first; half hours and closed days', () => {
    const rows = hoursRows(
      week([
        { days: ['sat', 'sun', 'mon', 'tue', 'wed'], open: '10:00', close: '20:00' },
        { days: ['thu'], open: '09:30', close: '14:00' },
      ]),
    );
    expect(rows).toEqual([
      { days: 'شنبه تا چهارشنبه', hours: '۱۰ تا ۲۰' },
      { days: 'پنج‌شنبه', hours: '۹:۳۰ تا ۱۴' },
      { days: 'جمعه', hours: null },
    ]);
  });

  it('UH3 the table names its rows and shows «تعطیل» for a closed day; the status box is reserved', () => {
    const { container } = render(
      <HoursTable
        hours={week([{ days: ['sat'], open: '10:00', close: '20:00' }])}
        status={<span>وضعیت</span>}
      />,
    );
    expect(screen.getByRole('rowheader', { name: 'شنبه' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'یک‌شنبه تا جمعه' })).toBeTruthy();
    expect(screen.getByText('تعطیل')).toBeTruthy();
    // A flex box: a 32 px badge stays 32 px (in a line box the strut's descent grew the row).
    expect(container.querySelector('.flex.min-h-8.items-center')?.textContent).toBe('وضعیت');
  });

  it('UH6 a full-width column keeps day and hours close: the table is capped (screens 10)', () => {
    const { container } = render(
      <HoursTable hours={week([{ days: ['sat'], open: '10:00', close: '20:00' }])} />,
    );
    // The aside's 26rem at 1024 px fits under the cap; a 770 px column no longer spreads the row.
    expect((container.firstChild as HTMLElement).className.split(' ')).toContain('max-w-[28rem]');
  });

  it('UH4 the badge: a skeleton of the same height until the state is known, then its label', () => {
    const labels = hoursBadgeLabels();
    const pending = render(<HoursBadge state={null} labels={labels} icon={<svg />} />);
    expect(pending.container.querySelector('.animate-pulse.h-8')).not.toBeNull();
    pending.unmount();
    render(<HoursBadge state="open" labels={labels} icon={<svg />} />);
    const open = screen.getByText('الان باز است');
    expect(open.className).toContain('min-h-8');
    expect(open.className).toContain('text-success');
  });

  it('UH5 closed states are quiet, never red', () => {
    const labels = hoursBadgeLabels();
    for (const state of ['closed', 'before-open', 'holiday', 'closing-soon'] as const) {
      const { container, unmount } = render(
        <HoursBadge state={state} labels={labels} icon={<svg />} />,
      );
      expect(container.innerHTML).not.toMatch(/danger/);
      expect(container.textContent).toBe(labels[state]);
      unmount();
    }
  });
});
