import config from '@payload-config';
import { getPayload, type Payload } from 'payload';

/** The Local API client; Payload caches one instance per process. Server only. */
export function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}
