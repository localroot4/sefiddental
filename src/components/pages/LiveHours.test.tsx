import { readFileSync } from 'node:fs';
import path from 'node:path';

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFormSession, type FormSession } from '@/components/chrome/formSession';
import { hoursBadgeLabels } from '@/components/ui/Hours';
import { HoursBadge } from '@/components/ui/HoursBadge';
import type { HoursStateName } from '@/lib/hoursState';

import { LiveHours } from './LiveHours';

vi.mock('@/components/chrome/formSession', () => ({ getFormSession: vi.fn() }));

const session = (state: FormSession['hours']['state'], nextChangeAt: string): FormSession => ({
  csrf: 'csrf',
  ts: 'ts',
  ttlSeconds: 7200,
  hours: {
    state,
    callsAllowed: state === 'open',
    showClosedSheet: state !== 'open',
    nextChangeAt,
    copy: { callback: '', closedSheet: null, emergencyClosedLine: null },
  },
});

const glyph = <svg data-glyph="clock" />;
const labels = hoursBadgeLabels();
// What Address.tsx renders on the server and hands to the island.
const badges = Object.fromEntries(
  [null, ...(Object.keys(labels) as HoursStateName[])].map((state) => [
    state ?? 'pending',
    <HoursBadge key={state} state={state} labels={labels} icon={glyph} />,
  ]),
) as Record<HoursStateName | 'pending', ReactNode>;

describe('LiveHours', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(getFormSession).mockReset();
  });

  it('LH1 a skeleton in the reserved box until the form session answers, then the state label', async () => {
    let answer: (value: FormSession | null) => void = () => {};
    vi.mocked(getFormSession).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { container } = render(<LiveHours badges={badges} />);
    expect(container.querySelector('[aria-hidden="true"].animate-pulse')).not.toBeNull();
    expect(screen.queryByText('الان باز است')).toBeNull();
    await act(async () => answer(session('open', '2099-01-01T00:00:00.000Z')));
    expect(screen.getByText('الان باز است')).toBeTruthy();
    expect(container.querySelector('[data-glyph="clock"]')).not.toBeNull();
  });

  it('LH2 no answer leaves the box empty: no endless skeleton, no guessed state', async () => {
    vi.mocked(getFormSession).mockResolvedValue(null);
    const { container } = render(<LiveHours badges={badges} />);
    await act(async () => {});
    expect(container.textContent).toBe('');
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('LH3 asks again when the state changes (closing time), so the label never goes stale', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-15T16:20:00.000Z') });
    vi.mocked(getFormSession)
      .mockResolvedValueOnce(session('open', '2026-10-15T16:30:00.000Z'))
      .mockResolvedValueOnce(session('closed', '2026-10-16T06:30:00.000Z'));
    render(<LiveHours badges={badges} />);
    await act(async () => {});
    expect(screen.getByText('الان باز است')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    });
    expect(screen.getByText('الان بسته است')).toBeTruthy();
    expect(getFormSession).toHaveBeenCalledTimes(2);
  });

  it('LH4 the island ships no labels and no icon code (F2): it imports only React and the form session', () => {
    const source = readFileSync(path.resolve('src/components/pages/LiveHours.tsx'), 'utf8');
    const imports = [...source.matchAll(/^import (?!type ).*? from '([^']+)';$/gm)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(['react', '@/components/chrome/formSession']);
  });
});
