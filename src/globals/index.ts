import type { GlobalConfig } from 'payload';

import { Clinic } from './Clinic';
import { Features, Notifier, SeoDefaults, SystemState } from './Settings';

/** The four content globals plus the cron bookkeeping global (freeze decision 18). */
export const globals: GlobalConfig[] = [Clinic, SeoDefaults, Features, Notifier, SystemState];
