// H-REDIRVALID chain rules with a fragment (phase 6 H20): `/vip` points at a path plus a tier
// anchor, so a slug change of that path must keep the alias one hop and keep the anchor.
import { describe, expect, it, vi } from 'vitest';

import { flattenRedirect, repointChains } from './redirects';

type Row = { id: number; from: string; to: string | null; active: boolean; statusCode?: string };

/** A request whose Local API returns `rows` from find and records each update. */
function fakeReq(rows: Row[]) {
  const update = vi.fn(async () => ({}));
  const find = vi.fn(async ({ where }: { where: unknown }) => {
    const text = JSON.stringify(where);
    // flattenRedirect asks for the active row whose `from` is the hop; repointChains for candidates.
    const from = /"from":\{"equals":"([^"]*)"\}/.exec(text)?.[1];
    return { docs: from === undefined ? rows : rows.filter((r) => r.from === from && r.active) };
  });
  return { req: { payload: { find, update } } as never, find, update };
}

const flatten = flattenRedirect as unknown as (args: object) => Promise<Record<string, unknown>>;
const repoint = repointChains as unknown as (args: object) => Promise<unknown>;
const collection = { slug: 'redirects' };

describe('H20 fragments in redirect chains', () => {
  it('RH1 repointing keeps the anchor of a row that pointed at `from#anchor`', async () => {
    const vip = { id: 1, from: '/vip', to: '/خدمات/ترمیم-دندان#سطح-ترمیم', active: true };
    const plain = { id: 2, from: '/old', to: '/خدمات/ترمیم-دندان', active: true };
    // A `like` candidate that only contains the path (another slug) stays as it is.
    const other = { id: 3, from: '/x', to: '/خدمات/ترمیم-دندان-کودکان#a', active: true };
    const { req, update } = fakeReq([vip, plain, other]);
    const doc = { id: 9, from: '/خدمات/ترمیم-دندان', to: '/خدمات/ترمیم', active: true };
    await repoint({ doc, req });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, data: { to: '/خدمات/ترمیم#سطح-ترمیم' } }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, data: { to: '/خدمات/ترمیم' } }),
    );
  });

  it('RH2 a new target with its own anchor wins, as a browser follows it', async () => {
    const vip = { id: 1, from: '/vip', to: '/a#old', active: true };
    const { req, update } = fakeReq([vip]);
    await repoint({ doc: { id: 9, from: '/a', to: '/b#new', active: true }, req });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, data: { to: '/b#new' } }));
  });

  it('RH3 a row that would point at itself is switched off, anchor or not', async () => {
    const back = { id: 1, from: '/b', to: '/a#x', active: true };
    const { req, update } = fakeReq([back]);
    await repoint({ doc: { id: 9, from: '/a', to: '/b', active: true }, req });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, data: { active: false } }),
    );
  });

  it('RH4 the candidate query matches `from` and `from#…`, active rows only, never itself', async () => {
    const { req, find } = fakeReq([]);
    await repoint({ doc: { id: 9, from: '/a', to: '/b', active: true }, req });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { or: [{ to: { equals: '/a' } }, { to: { like: '/a#' } }] },
            { active: { equals: true } },
            { id: { not_equals: 9 } },
          ],
        },
      }),
    );
  });

  it('RH5 flattening through a hop keeps the anchor the new row was given', async () => {
    const hop = { id: 1, from: '/خدمات/ترمیم-دندان', to: '/خدمات/ترمیم', active: true };
    const { req } = fakeReq([hop]);
    const data = { from: '/vip', to: '/خدمات/ترمیم-دندان#سطح-ترمیم' };
    expect(await flatten({ data, collection, req })).toMatchObject({
      to: '/خدمات/ترمیم#سطح-ترمیم',
    });
  });

  it('RH6 a hop whose target has an anchor replaces the one given; loops are still refused', async () => {
    const { req } = fakeReq([{ id: 1, from: '/a', to: '/b#tier', active: true }]);
    expect(await flatten({ data: { from: '/c', to: '/a#x' }, collection, req })).toMatchObject({
      to: '/b#tier',
    });
    const loop = fakeReq([{ id: 1, from: '/a', to: '/c#x', active: true }]);
    await expect(
      flatten({ data: { from: '/c', to: '/a' }, collection, req: loop.req }),
    ).rejects.toThrow();
  });
});
