import { log } from '@/lib/log/logger';

/**
 * A dashboard widget's read (H33): its time at debug level, to decide on a cache (one over
 * 200 ms gets 60 s), and a failed read as null, so the widget says «نامشخص» instead of breaking
 * the dashboard.
 */
export async function widgetRead<T>(widget: string, read: () => Promise<T>): Promise<T | null> {
  const started = performance.now();
  try {
    return await read();
  } catch (err) {
    log.warn({ msg: 'admin_widget_failed', widget, err });
    return null;
  } finally {
    log.debug({ msg: 'admin_widget', widget, ms: Math.round(performance.now() - started) });
  }
}
