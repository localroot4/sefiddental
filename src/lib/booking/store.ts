import type { Payload, RequiredDataFromCollectionSlug, Where } from 'payload';

import type { BookingStore, NewBooking } from './handler';

/**
 * The Payload side of the booking handlers: Local API with overrideAccess (collection create is
 * staff only; duplicateSubmissions and ipHash are closed to the REST API), no user on the
 * request. Every limit query uses an index: (phone, createdAt), (ipHash, createdAt) or the
 * duplicate entries' ipHash.
 */
export function payloadBookingStore(getPayload: () => Promise<Payload>): BookingStore {
  const since = (ms: number): Where => ({
    createdAt: { greater_than_equal: new Date(ms).toISOString() },
  });
  return {
    async recentClean(phone, kind, sinceMs) {
      const payload = await getPayload();
      const { docs } = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { phone: { equals: phone } },
            since(sinceMs),
            { kind: { equals: kind } },
            { status: { not_in: ['suspicious', 'spam'] } },
          ],
        },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
        select: {
          createdAt: true,
          status: true,
          sidHash: true,
          duplicateSubmissions: { sidHash: true, at: true },
        },
        overrideAccess: true,
      });
      return docs.map((doc) => {
        const createdAtMs = Date.parse(doc.createdAt);
        return {
          id: doc.id,
          createdAtMs,
          status: doc.status ?? 'new',
          marks: [
            { sidHash: doc.sidHash, atMs: createdAtMs },
            ...(doc.duplicateSubmissions ?? []).map((e) => ({
              sidHash: e.sidHash,
              atMs: Date.parse(e.at ?? ''),
            })),
          ].filter((m): m is { sidHash: string; atMs: number } => typeof m.sidHash === 'string'),
        };
      });
    },
    async countFromIp(ipHash, sinceMs, kind) {
      const payload = await getPayload();
      const ofKind = kind ? [{ kind: { equals: kind } }] : [];
      const sinceIso = new Date(sinceMs).toISOString();
      const [rows, appended] = await Promise.all([
        payload.count({
          collection: 'bookings',
          where: { and: [{ ipHash: { equals: ipHash } }, since(sinceMs), ...ofKind] },
          overrideAccess: true,
        }),
        // Rows holding an entry from this hash; the entries themselves are counted below.
        payload.find({
          collection: 'bookings',
          where: {
            and: [
              { 'duplicateSubmissions.ipHash': { equals: ipHash } },
              { 'duplicateSubmissions.at': { greater_than_equal: sinceIso } },
              ...ofKind,
            ],
          },
          limit: 100,
          depth: 0,
          select: { duplicateSubmissions: true },
          overrideAccess: true,
        }),
      ]);
      const entries = appended.docs.flatMap((doc) => doc.duplicateSubmissions ?? []);
      return (
        rows.totalDocs +
        entries.filter(
          (entry) =>
            (entry as { ipHash?: string | null }).ipHash === ipHash &&
            Date.parse(entry.at ?? '') >= sinceMs,
        ).length
      );
    },
    async countSuspiciousFromIp(ipHash, sinceMs) {
      const payload = await getPayload();
      const { totalDocs } = await payload.count({
        collection: 'bookings',
        where: {
          and: [
            { ipHash: { equals: ipHash } },
            since(sinceMs),
            { status: { in: ['suspicious', 'spam'] } },
          ],
        },
        overrideAccess: true,
      });
      return totalDocs;
    },
    async create(row: NewBooking) {
      const payload = await getPayload();
      // The flag `bad_token` and the duplicate `triage` and `ipHash` fields join the generated
      // types with this phase's migration; the row is checked by the collection's own validation.
      const data = row as unknown as RequiredDataFromCollectionSlug<'bookings'>;
      const doc = await payload.create({ collection: 'bookings', data, overrideAccess: true });
      return { id: doc.id };
    },
    async appendDuplicate(id, entry, max) {
      const payload = await getPayload();
      const doc = await payload.findByID({
        collection: 'bookings',
        id,
        depth: 0,
        select: { duplicateSubmissions: true },
        overrideAccess: true,
      });
      const earlier = doc.duplicateSubmissions ?? [];
      if (earlier.length >= max) {
        // One SQL `appends_dropped + 1`: no read-modify-write, no hooks, no audit row (S10).
        await payload.db.updateOne({
          collection: 'bookings',
          id,
          data: { appendsDropped: { $inc: 1 } },
          returning: false,
        });
        return false;
      }
      await payload.update({
        collection: 'bookings',
        id,
        data: { duplicateSubmissions: [...earlier, entry] } as never,
        overrideAccess: true,
      });
      return true;
    },
  };
}
