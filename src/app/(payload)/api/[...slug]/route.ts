/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

// Edited: anonymous media uploads are refused before the body is read (src/payload/mediaWriteGuard.ts).
import { refuseAnonymousMediaWrites } from '@/payload/mediaWriteGuard'

export const GET = REST_GET(config)
export const POST = refuseAnonymousMediaWrites(REST_POST(config))
export const DELETE = REST_DELETE(config)
export const PATCH = refuseAnonymousMediaWrites(REST_PATCH(config))
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
