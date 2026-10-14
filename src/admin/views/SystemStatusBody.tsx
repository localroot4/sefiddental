import type { ReactNode } from 'react';

import { formatJalali, formatTimeFa } from '@/lib/jalali';
import { formatNumberFa } from '@/lib/persianText';

import styles from './SystemStatus.module.css';
import type { SystemStatusData } from './systemStatusData';

const UNKNOWN = 'نامشخص';

function at(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return `${formatJalali(date, 'd MMMM yyyy')}، ساعت ${formatTimeFa(date)}`;
}

const num = (value: number | null | undefined) =>
  value === null || value === undefined ? UNKNOWN : formatNumberFa(value);

function bytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  const mb = value / 1024 ** 2;
  if (mb >= 1024) return `${formatNumberFa(Math.round((mb / 1024) * 10) / 10)} گیگابایت`;
  return `${formatNumberFa(Math.round(mb * 10) / 10)} مگابایت`;
}

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0
    ? `${formatNumberFa(hours)} ساعت و ${formatNumberFa(minutes)} دقیقه`
    : `${formatNumberFa(minutes)} دقیقه`;
}

const onOff = (value: boolean) => (value ? 'روشن' : 'خاموش');
const cspLabel = (mode: 'enforce' | 'report-only') => (mode === 'enforce' ? 'اجباری' : 'فقط گزارش');

const Ltr = ({ children }: { children: ReactNode }) => (
  <bdi dir="ltr" className={styles.ltr}>
    {children}
  </bdi>
);

function Section(props: {
  id: string;
  title: string;
  span?: 'wide' | 'fill';
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={props.id}
      className={props.span ? `${styles.section} ${styles[props.span]}` : styles.section}
    >
      <h2 id={props.id} className={styles.heading}>
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className={styles.list}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const Status = ({ ok, text }: { ok: boolean; text: string }) => (
  <span className={ok ? styles.ok : styles.bad}>{text}</span>
);

/** The view's content (spec 13.3); presentational, so it renders from collected data in tests. */
export function SystemStatusBody({ data }: { data: SystemStatusData }) {
  const { runtime, version, database, jobs, media, config, gaps } = data;
  const cron = jobs.lastCron;
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>وضعیت سیستم</h1>
        <p className={styles.updated}>به‌روزشده در {at(data.generatedAt)}</p>
      </header>
      <div className={styles.grid}>
        <Section id="status-database" title="پایگاه داده">
          <Rows
            rows={[
              [
                'نوع',
                <Ltr key="a">{database.adapter === 'postgres' ? 'PostgreSQL' : 'SQLite'}</Ltr>,
              ],
              [
                'وضعیت',
                <Status
                  key="s"
                  ok={database.reachable}
                  text={database.reachable ? 'در دسترس' : 'در دسترس نیست'}
                />,
              ],
              [
                'زمان پاسخ',
                database.latencyMs === null ? UNKNOWN : `${num(database.latencyMs)} میلی‌ثانیه`,
              ],
              ['مهاجرت‌های اجراشده', num(database.migrations?.applied)],
              [
                'آخرین مهاجرت',
                database.migrations?.newest ? (
                  <Ltr key="m">{database.migrations.newest}</Ltr>
                ) : (
                  UNKNOWN
                ),
              ],
              [
                'مهاجرت‌های در انتظار',
                database.migrations === null ? (
                  UNKNOWN
                ) : database.migrations.pending.length === 0 ? (
                  <Status key="p" ok text="هیچ" />
                ) : (
                  <Status key="p" ok={false} text={database.migrations.pending.join('، ')} />
                ),
              ],
            ]}
          />
        </Section>

        <Section id="status-jobs" title="صف کارها">
          <Rows
            rows={[
              ['در صف', num(jobs.queued)],
              ['در حال اجرا', num(jobs.processing)],
              [
                'گیرکرده (بیش از ۱۰ دقیقه)',
                jobs.stuck === null ? (
                  UNKNOWN
                ) : (
                  <Status key="st" ok={jobs.stuck === 0} text={num(jobs.stuck)} />
                ),
              ],
              ['آخرین اجرای زمان‌بند', cron?.at ? at(cron.at) : 'هنوز اجرا نشده است'],
              [
                'نتیجهٔ آخرین اجرا',
                cron?.at
                  ? `${num(cron.ranJobs)} کار، ${num(cron.failed)} ناموفق، ${num(cron.durationMs)} میلی‌ثانیه`
                  : UNKNOWN,
              ],
              [
                'خطای آخرین اجرا',
                cron?.error ? <Status key="e" ok={false} text={cron.error} /> : 'ندارد',
              ],
            ]}
          />
        </Section>

        <Section id="status-media" title="ذخیره‌سازی رسانه">
          <Rows
            rows={[
              ['محل', media.storage === 's3' ? 'فضای ابری (S3)' : 'دیسک سرور'],
              ['تعداد فایل‌ها', num(media.files)],
              ['حجم با همهٔ اندازه‌ها', bytes(media.bytes)],
              [
                'فضای آزاد دیسک',
                media.storage === 's3' ? 'ندارد (فضای ابری)' : bytes(media.freeBytes),
              ],
            ]}
          />
        </Section>

        <Section id="status-version" title="نسخه و اجرا">
          <Rows
            rows={[
              ['شناسهٔ استقرار', <Ltr key="sha">{version.gitSha}</Ltr>],
              ['زمان ساخت', version.buildTime ? at(version.buildTime) : UNKNOWN],
              ['نسخهٔ Node', <Ltr key="node">{runtime.node}</Ltr>],
              ['حالت اجرا', <Ltr key="env">{runtime.nodeEnv}</Ltr>],
              ['روشن از', `${at(runtime.startedAt)} (${duration(runtime.uptimeSeconds)})`],
              ['حافظهٔ مصرفی', bytes(runtime.rssBytes)],
              ['آخرین بذر داده', data.lastSeedAt ? at(data.lastSeedAt) : 'ثبت نشده است'],
            ]}
          />
        </Section>

        <Section id="status-config" title="پیکربندی" span="fill">
          <Rows
            rows={[
              ['نشانی سایت', <Ltr key="url">{config.siteUrl}</Ltr>],
              ['نمایه‌شدن در گوگل', onOff(config.allowIndexing)],
              ['حالت تعمیر', onOff(config.maintenance)],
              ['سیاست امنیت محتوای سایت', cspLabel(config.cspMode)],
              ['سیاست امنیت محتوای پنل', cspLabel(config.cspAdminMode)],
              [
                'اعتماد به سربرگ‌های پراکسی',
                config.trustProxyHeaders ? (
                  'روشن'
                ) : (
                  <Status
                    key="t"
                    ok={false}
                    text="خاموش: همهٔ بازدیدکننده‌ها یک سهمیهٔ درخواست مشترک دارند."
                  />
                ),
              ],
              [
                'ارسال ایمیل',
                config.smtp ? (
                  'از طریق SMTP'
                ) : (
                  // The console adapter logs only the recipient, never the reset link (SEC-S8).
                  <Status key="m" ok={false} text="غیرفعال؛ بازنشانی رمز کار نمی‌کند." />
                ),
              ],
            ]}
          />
        </Section>

        <Section id="status-failed" title="کارهای ناموفق در ۷ روز اخیر" span="wide">
          {jobs.failed === null ? (
            <p className={styles.empty}>{UNKNOWN}</p>
          ) : jobs.failed.length === 0 ? (
            <p className={styles.empty}>در ۷ روز اخیر کار ناموفقی ثبت نشده است.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">کار</th>
                    <th scope="col">پیام خطا</th>
                    <th scope="col">دفعات اجرا</th>
                    <th scope="col">زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.failed.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <Ltr>{job.task}</Ltr>
                      </td>
                      <td>
                        <Ltr>{job.message}</Ltr>
                      </td>
                      <td>{num(job.tries)}</td>
                      <td>{at(job.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section id="status-gaps" title="کمبود محتوا" span="wide">
          {gaps === null ? (
            <p className={styles.empty}>{UNKNOWN}</p>
          ) : gaps.total === 0 ? (
            <p className={styles.empty}>همهٔ اطلاعات لازم وارد شده است.</p>
          ) : (
            <>
              <p className={styles.empty}>
                {num(gaps.total)} مورد باز. هر مورد به بخش مربوط در پنل می‌رود.
              </p>
              {gaps.groups.map((group) => (
                <div key={group.kind} className={styles.group}>
                  <h3>{group.headingFa}</h3>
                  <ul className={styles.items}>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <a href={item.adminUrl}>{item.labelFa}</a>
                        {item.gapRow !== null ? ` (ردیف ${num(item.gapRow)} فهرست کمبودها)` : null}
                        {item.fieldPath ? (
                          <>
                            {' '}
                            <Ltr>{item.fieldPath}</Ltr>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </Section>

        <Section id="status-logs" title="هشدارها و خطاهای اخیر" span="wide">
          <p className={styles.empty}>
            از شروع فرایند در {at(runtime.startedAt)}؛ با هر راه‌اندازی دوباره خالی می‌شود.
          </p>
          {data.logs.length === 0 ? (
            <p className={styles.empty}>هشدار یا خطایی ثبت نشده است.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">زمان</th>
                    <th scope="col">سطح</th>
                    <th scope="col">رویداد</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((line, index) => (
                    <tr key={`${line.time}-${index}`}>
                      <td>{at(line.time)}</td>
                      <td>{line.level === 'warn' ? 'هشدار' : <Status ok={false} text="خطا" />}</td>
                      <td>
                        <Ltr>{line.msg}</Ltr>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
