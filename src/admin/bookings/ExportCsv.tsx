'use client';

import { Button, toast } from '@payloadcms/ui';
import { useState } from 'react';

import { adminText } from '@/i18n/fa-admin';

import styles from './bookings.module.css';

/** The list URL's filter and search, for the export endpoint (values never leave the page). */
function exportUrl(): string {
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams(
    [...current].filter(([key]) => key.startsWith('where') || key === 'search'),
  );
  return `/api/bookings/export${params.size > 0 ? `?${params}` : ''}`;
}

/** Saves a response body under the server's file name. */
async function save(response: Response): Promise<void> {
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name ?? 'bookings.csv';
  // Firefox follows only a link in the document; revoking at once can cancel the download.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * «خروجی CSV» for admins (rendered by BookingTabs only for them; the endpoint checks again):
 * the current filter as a file. Errors come back as the endpoint's Persian message.
 */
export function ExportCsv() {
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      const response = await fetch(exportUrl(), { credentials: 'same-origin' });
      if (response.ok) await save(response);
      else {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(body?.message ?? adminText('admin.network'));
      }
    } catch {
      toast.error(adminText('admin.network'));
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      buttonStyle="secondary"
      className={styles.action}
      disabled={pending}
      id="bookings-export-csv"
      margin={false}
      onClick={() => void run()}
      size="medium"
    >
      {pending ? (
        adminText('admin.csv.pending')
      ) : (
        <>
          {adminText('admin.csv.button')}{' '}
          <bdi dir="ltr" className={styles.ltr}>
            CSV
          </bdi>
        </>
      )}
    </Button>
  );
}
