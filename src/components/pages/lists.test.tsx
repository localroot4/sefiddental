import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Media } from '@/payload-types';

import { DentistList, GuideList } from './lists';

const PHOTO = { id: 1, alt: 'پرتره', url: '/media/p.jpg', width: 1080, height: 1350 } as Media;

describe('pages lists', () => {
  it('PL1 no published dentist: one sentence and one booking action, no name and no card', () => {
    const { container } = render(<DentistList doctors={[]} />);
    expect(screen.getByText(/معرفی دندانپزشکان کلینیک هنوز منتشر نشده است/)).toBeTruthy();
    const action = screen.getByRole('link', { name: 'رزرو نوبت' });
    expect(action.getAttribute('href')).toBe('/رزرو-نوبت');
    expect(action.hasAttribute('data-booking-cta')).toBe(true);
    expect(container.textContent).not.toContain('دکتر');
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });

  it('PL2 a dentist card: «دکتر» and the name linking to the profile, the council number as an LTR island', () => {
    render(
      <DentistList
        doctors={[
          {
            id: 7,
            name: 'نام خانوادگی',
            slug: 'دکتر-نام-خانوادگی',
            specialty: 'دندانپزشک عمومی',
            councilNumber: '123456',
            photo: PHOTO,
          },
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: 'دکتر نام خانوادگی' });
    expect(link.getAttribute('href')).toBe('/پزشکان/دکتر-نام-خانوادگی');
    const council = screen.getByText('۱۲۳۴۵۶');
    expect(council.tagName).toBe('BDI');
    expect(council.getAttribute('dir')).toBe('ltr');
    expect(screen.queryByText(/هنوز منتشر نشده است/)).toBeNull();
  });

  it('PL3 guides: the empty state while none is published, else one card per published guide', () => {
    const empty = render(<GuideList guides={[]} />);
    expect(screen.getByText(/راهنماها پس از بازبینی دندانپزشک/)).toBeTruthy();
    empty.unmount();
    render(
      <GuideList
        guides={[{ id: 1, path: '/راهنمای-بیمار/اولین-مراجعه', title: 'اولین مراجعه', lead: null }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'اولین مراجعه' }).getAttribute('href')).toBe(
      '/راهنمای-بیمار/اولین-مراجعه',
    );
    expect(screen.queryByText(/راهنماها پس از بازبینی/)).toBeNull();
  });
});
