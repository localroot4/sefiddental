import { describe, expect, it } from 'vitest';

import { activeTab, BOOKING_TABS, savedOrderNotice, tabHref } from './tabs';

const paramsOf = (href: string) =>
  Object.fromEntries(new URL(href, 'https://admin.test').searchParams.entries());

describe('booking list tabs (freeze G15, D-2, D-3)', () => {
  it('TB1 every tab link names its sort; «همه» names the urgency rank; filters use Payload’s shape', () => {
    for (const tab of BOOKING_TABS) {
      expect(paramsOf(tabHref(tab.key)).sort, tab.key).toBe(tab.sort);
    }
    expect(paramsOf(tabHref('all'))).toEqual({ sort: 'urgencyRank' });
    // Rows without a due time would sort first on SQLite and last on PostgreSQL: left out.
    expect(paramsOf(tabHref('callbackDue'))).toEqual({
      'where[or][0][and][0][status][equals]': 'new',
      'where[or][0][and][1][callbackDueAt][exists]': 'true',
      sort: 'callbackDueAt',
    });
    expect(paramsOf(tabHref('emergency'))).toEqual({
      'where[or][0][and][0][kind][equals]': 'emergency',
      'where[or][0][and][1][status][in][0]': 'new',
      'where[or][0][and][1][status][in][1]': 'contacted',
      sort: 'urgencyRank',
    });
    expect(paramsOf(tabHref('closed'))).toMatchObject({
      'where[or][0][and][0][status][in][2]': 'spam',
      sort: '-createdAt',
    });
  });

  it('TB2 the active tab follows the URL filter and sort, then the saved sort', () => {
    for (const tab of BOOKING_TABS) {
      expect(activeTab(paramsOf(tabHref(tab.key))), tab.key).toBe(tab.key);
    }
    // A tab's filter with another sort is no tab: the list does not show that view's order.
    expect(activeTab({ ...paramsOf(tabHref('new')), sort: 'callbackDueAt' })).toBeNull();
    expect(activeTab({ ...paramsOf(tabHref('callbackDue')), sort: 'urgencyRank' })).toBeNull();
    // No sort in the URL: the saved one decides; without one the urgency order is «همه».
    expect(activeTab({})).toBe('all');
    expect(activeTab({}, 'callbackDueAt')).toBeNull();
    expect(activeTab({ page: '2', limit: '50', sort: 'urgencyRank' })).toBe('all');
    expect(activeTab({ 'where[or][0][and][0][heardFrom][equals]': 'google' })).toBeNull();
  });

  it('TB3 a bare list URL that follows a saved sort other than urgency says so', () => {
    expect(savedOrderNotice({}, 'callbackDueAt')).toBe(true);
    expect(savedOrderNotice({ search: '0912', page: '2' }, '-createdAt')).toBe(true);
    // The urgency order, an explicit sort, or a tab that explains the order: no notice.
    expect(savedOrderNotice({})).toBe(false);
    expect(savedOrderNotice({}, 'urgencyRank')).toBe(false);
    const ownFilter = { 'where[or][0][and][0][heardFrom][equals]': 'google' };
    expect(savedOrderNotice(ownFilter, 'urgencyRank')).toBe(false);
    expect(savedOrderNotice(ownFilter, '-createdAt')).toBe(true);
    expect(savedOrderNotice({ sort: '-createdAt' }, 'callbackDueAt')).toBe(false);
    expect(savedOrderNotice(paramsOf(tabHref('suspicious')), '-createdAt')).toBe(false);
  });
});
