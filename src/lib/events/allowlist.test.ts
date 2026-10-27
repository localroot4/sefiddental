import { describe, expect, it } from 'vitest';

import { EVENT_LOCATIONS, EVENT_NAMES, normalizeEvent, PAGE_TYPES } from './allowlist';

const keys = new Set(['ceramic-laminate']);
const DAY = '2026-10-13';

describe('normalizeEvent (spec-data 4.2)', () => {
  it('E1 a known event with known dimensions passes through', () => {
    expect(
      normalizeEvent(
        {
          event: 'call_click',
          location: 'header',
          pageType: 'service',
          serviceKey: 'ceramic-laminate',
        },
        DAY,
        keys,
      ),
    ).toEqual({
      date: DAY,
      event: 'call_click',
      location: 'header',
      pageType: 'service',
      serviceKey: 'ceramic-laminate',
    });
  });

  it('E2 an unknown event is dropped', () => {
    expect(normalizeEvent({ event: 'page_view' }, DAY, keys)).toBeNull();
    expect(normalizeEvent(null, DAY, keys)).toBeNull();
    expect(normalizeEvent('call_click', DAY, keys)).toBeNull();
  });

  it('E3 location: missing is none, unknown is other', () => {
    expect(normalizeEvent({ event: 'call_click' }, DAY, keys)?.location).toBe('none');
    expect(normalizeEvent({ event: 'call_click', location: '' }, DAY, keys)?.location).toBe('none');
    expect(normalizeEvent({ event: 'call_click', location: 'banner' }, DAY, keys)?.location).toBe(
      'other',
    );
  });

  it('E4 page type: unknown or missing is other', () => {
    expect(normalizeEvent({ event: 'call_click' }, DAY, keys)?.pageType).toBe('other');
    expect(normalizeEvent({ event: 'call_click', pageType: 'contact' }, DAY, keys)?.pageType).toBe(
      'other',
    );
  });

  it('E5 a service key outside the published keys is none', () => {
    expect(
      normalizeEvent({ event: 'call_click', serviceKey: 'implant' }, DAY, keys)?.serviceKey,
    ).toBe('none');
    expect(normalizeEvent({ event: 'call_click', serviceKey: 7 }, DAY, keys)?.serviceKey).toBe(
      'none',
    );
  });

  it('E6 the lists hold the frozen values and the sentinels', () => {
    expect(EVENT_NAMES).toHaveLength(15);
    expect(EVENT_LOCATIONS).toContain('none');
    expect(EVENT_LOCATIONS).toContain('other');
    expect(PAGE_TYPES).toContain('other');
    expect(PAGE_TYPES).not.toContain('contact');
  });

  it('E7 scene_view keeps a scene id as its location; an unknown scene becomes other', () => {
    const scenes = [
      'hero',
      'trust',
      'services',
      'restoration',
      'workflow',
      'compare',
      'dentists',
      'voices',
      'first-visit',
      'booking',
      'footer',
    ];
    for (const scene of scenes) {
      expect(
        normalizeEvent({ event: 'scene_view', location: scene, pageType: 'home' }, DAY, keys),
      ).toEqual({
        date: DAY,
        event: 'scene_view',
        location: scene,
        pageType: 'home',
        serviceKey: 'none',
      });
    }
    expect(normalizeEvent({ event: 'scene_view', location: 'intro' }, DAY, keys)?.location).toBe(
      'other',
    );
  });
});
