'use client';

import { Button, toast } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { adminText } from '@/i18n/fa-admin';
import { redirectsText } from '@/i18n/fa-redirects';
import { formatNumberFa } from '@/lib/persianText';
import type { ImportPlan, Outcome } from '@/lib/redirects/importCsv';

import styles from './importCsv.module.css';

type Answer = ImportPlan & { digest?: string; written?: number; message?: string };
interface Checked {
  csv: string;
  origins: string;
  answer: Answer;
}

/** POST to the import endpoint; a refusal or a network error comes back as its Persian message. */
async function send(body: object): Promise<Answer | string> {
  try {
    const response = await fetch('/api/redirects/import', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const answer = (await response.json().catch(() => ({}))) as Answer;
    return response.ok ? answer : (answer.message ?? adminText('admin.network'));
  } catch {
    return adminText('admin.network');
  }
}

/**
 * `beforeListTable` of redirects (admin only, as the whole collection): the old-URL CSV import.
 * A dry run first shows one outcome per line; «ثبت» then sends the same file and the plan's
 * digest, and the endpoint writes only if the plan is still the same.
 */
export function ImportCsv() {
  const router = useRouter();
  const id = useId();
  const [origins, setOrigins] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const run = async (body: object): Promise<Answer | null> => {
    setError('');
    setPending(true);
    const answer = await send(body);
    setPending(false);
    if (typeof answer === 'string') setError(answer);
    return typeof answer === 'string' ? null : answer;
  };
  const check = async () => {
    setChecked(null);
    if (!file) {
      setError(redirectsText('redirects.import.chooseFile'));
      return;
    }
    const csv = await file.text();
    const answer = await run({ csv, origins });
    if (answer?.error) setError(answer.error);
    if (answer) setChecked({ csv, origins, answer });
  };
  const apply = async () => {
    if (!checked) return;
    const { csv, answer } = checked;
    const done = await run({ csv, origins: checked.origins, apply: true, digest: answer.digest });
    if (!done) return;
    toast.success(
      redirectsText('redirects.import.applied', { n: formatNumberFa(done.written ?? 0) }),
    );
    setChecked(null);
    router.refresh();
  };

  const rows = checked?.answer.rows ?? [];
  const count = (o: Outcome) => formatNumberFa(rows.filter((r) => r.outcome === o).length);
  const warnings = rows.filter((r) => r.note && r.outcome !== 'refused').length;
  const toWrite = rows.filter((r) => r.outcome === 'new' || r.outcome === 'update').length;

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>{redirectsText('redirects.import.title')}</summary>
      <p className={styles.help}>{redirectsText('redirects.import.intro')}</p>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={`${id}-origins`}>{redirectsText('redirects.import.origins')}</label>
          <input
            aria-describedby={`${id}-origins-help`}
            className={styles.input}
            dir="ltr"
            id={`${id}-origins`}
            onChange={(e) => {
              setOrigins(e.target.value);
              setChecked(null);
            }}
            type="text"
            value={origins}
          />
          <p className={styles.help} id={`${id}-origins-help`}>
            {redirectsText('redirects.import.originsHelp')}
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-file`}>{redirectsText('redirects.import.file')}</label>
          <input
            accept=".csv,text/csv"
            className={styles.input}
            id={`${id}-file`}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setChecked(null);
            }}
            type="file"
          />
        </div>
      </div>
      <div className={styles.actions}>
        <Button
          buttonStyle="secondary"
          disabled={pending}
          margin={false}
          onClick={() => void check()}
          size="medium"
        >
          {redirectsText(pending ? 'redirects.import.checking' : 'redirects.import.check')}
        </Button>
        {checked && !checked.answer.error && toWrite > 0 ? (
          <Button disabled={pending} margin={false} onClick={() => void apply()} size="medium">
            {pending
              ? redirectsText('redirects.import.applying')
              : redirectsText('redirects.import.apply', { n: formatNumberFa(toWrite) })}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <>
          <p className={styles.counts} role="status">
            {redirectsText('redirects.import.summary', {
              new: count('new'),
              update: count('update'),
              unchanged: count('unchanged'),
              refused: count('refused'),
              warnings: formatNumberFa(warnings),
            })}
            {toWrite === 0 && !checked?.answer.error
              ? ` ${redirectsText('redirects.import.nothing')}`
              : ''}
          </p>
          <div
            aria-label={redirectsText('redirects.import.table')}
            className={styles.scroll}
            role="region"
            tabIndex={0}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  {(['line', 'from', 'to', 'outcome', 'note'] as const).map((col) => (
                    <th key={col} scope="col">
                      {redirectsText(`redirects.import.col.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line}>
                    <td>{formatNumberFa(row.line)}</td>
                    <td>
                      <bdi className={styles.path} dir="ltr">
                        {row.from}
                      </bdi>
                    </td>
                    <td>
                      {row.to === null ? (
                        redirectsText('redirects.import.gone')
                      ) : (
                        <bdi className={styles.path} dir="ltr">
                          {row.to}
                        </bdi>
                      )}
                    </td>
                    <td className={styles[row.outcome]}>
                      {redirectsText(`redirects.import.outcome.${row.outcome}`)}
                    </td>
                    <td className={row.outcome === 'refused' ? undefined : styles.warning}>
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </details>
  );
}
