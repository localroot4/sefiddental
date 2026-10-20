import {
  schedulePublishHandler,
  type SchedulePublishHandlerArgs,
} from '@payloadcms/ui/utilities/schedulePublishHandler';
import {
  docAccessOperation,
  docAccessOperationGlobal,
  Forbidden,
  type PayloadRequest,
  type SanitizedConfig,
  type ServerFunction,
  ValidationError,
} from 'payload';
import { hasScheduledPublishEnabled } from 'payload/shared';

type Target = Pick<SchedulePublishHandlerArgs, 'doc' | 'global'>;

/**
 * True when this session may publish the target: the update access that Payload's own
 * upcoming-list handler checks, TOTP wrapper included.
 */
async function mayPublish(req: PayloadRequest, { doc, global }: Target): Promise<boolean> {
  const data = { _status: 'published' };
  if (doc) {
    const config = req.payload.collections[doc.relationTo]?.config;
    if (!config || !hasScheduledPublishEnabled(config)) return false;
    const access = await docAccessOperation({ id: doc.value, collection: { config }, data, req });
    return Boolean(access.update);
  }
  if (global) {
    const globalConfig = req.payload.config.globals.find(({ slug }) => slug === global);
    if (!globalConfig || !hasScheduledPublishEnabled(globalConfig)) return false;
    return Boolean((await docAccessOperationGlobal({ data, globalConfig, req })).update);
  }
  return false;
}

/**
 * Payload's `schedule-publish` server function checks only `access.admin` (staff), then queues
 * the job and deletes jobs with access overridden, and the job later runs as the scheduling user
 * without a TOTP check (SEC-AUTH-1, SEC-AUTH-2). Here the session must pass the target's update
 * access first: for the job it deletes and for the one it queues.
 */
export const guardedSchedulePublish: ServerFunction<SchedulePublishHandlerArgs> = async (args) => {
  const { req, deleteID, doc, global } = args;
  if (deleteID !== undefined && deleteID !== null) {
    const job = await req.payload.findByID({
      collection: 'payload-jobs',
      id: deleteID,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    });
    if (job?.taskSlug !== 'schedulePublish' || !(await mayPublish(req, job.input as Target))) {
      throw new Forbidden(req.t);
    }
  }
  // The admin removes an event with deleteID alone; any other call must name what it publishes.
  const queuesTarget = Boolean(doc || global) || deleteID === undefined || deleteID === null;
  if (queuesTarget && !(await mayPublish(req, { doc, global }))) throw new Forbidden(req.t);
  return schedulePublishHandler(args);
};

/** Server functions that replace Payload's own (handleServerFunctions `serverFunctions`). */
export const adminServerFunctions = { 'schedule-publish': guardedSchedulePublish };

const WRAPPED = Symbol.for('sefid.scheduleBlockMessages');
type TaskHandler = ((args: never) => unknown) & { [WRAPPED]?: true };

/** The block messages of a refused publish, as the editor saw them in the form. */
export const blockMessages = (error: ValidationError): string =>
  error.data.errors
    // A record label (per language) would print '[object Object]'; labels arrive resolved.
    .map((e) => (typeof e.label === 'string' ? `«${e.label}»: ${e.message}` : e.message))
    .join(' ');

/**
 * H12: a scheduled publish that fails the publish gate records the block messages (the job's
 * `error.message` and its log), not Payload's «following fields are invalid» line, so the
 * editorial calendar and the dashboard show what to fix. Wraps the schedulePublish task Payload
 * adds while sanitizing the config; call it once on init (idempotent). Payload reads the
 * handler from `config.jobs.tasks` on every run.
 */
export function withScheduleBlockMessages(config: SanitizedConfig): SanitizedConfig {
  const task = config.jobs?.tasks?.find((t) => t.slug === 'schedulePublish');
  const run = task?.handler as TaskHandler | string | undefined;
  if (!task || typeof run !== 'function' || run[WRAPPED]) return config;
  const wrapped: TaskHandler = async (args: never) => {
    try {
      return await run(args);
    } catch (error) {
      if (error instanceof ValidationError) throw new Error(blockMessages(error));
      throw error;
    }
  };
  wrapped[WRAPPED] = true;
  task.handler = wrapped as unknown as typeof task.handler;
  return config;
}
