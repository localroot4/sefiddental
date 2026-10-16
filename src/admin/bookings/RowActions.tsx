'use client';

import { Button, toast } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import type { DefaultCellComponentProps } from 'payload';
import { useState } from 'react';

import { adminText } from '@/i18n/fa-admin';

import styles from './bookings.module.css';
import { errorMessage } from './format';
import { focusCurrentTab } from './tabs';

const RESTORABLE = new Set(['suspicious', 'spam']);

/**
 * List cell «کار سریع»: one-click restore of a suspicious or spam request to «جدید» (R-6). The
 * record hooks add the `restored` flag and the history note; the audit log keeps the move.
 */
export function RowActions({ rowData }: DefaultCellComponentProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const id = rowData?.id as number | string | undefined;
  if (id === undefined || !RESTORABLE.has(String(rowData?.status))) return null;

  const restore = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'new' }),
      });
      if (response.ok) {
        // Stays pending until the refreshed list drops this button: no second PATCH. Its row or
        // its cell leaves, so focus goes to the tabs, not to the page start.
        toast.success(adminText('admin.restore.done'));
        router.refresh();
        focusCurrentTab();
        return;
      }
      toast.error(errorMessage(await response.json().catch(() => null)));
      setPending(false);
    } catch {
      toast.error(adminText('admin.network'));
      setPending(false);
    }
  };

  return (
    <Button
      buttonStyle="secondary"
      className={styles.action}
      disabled={pending}
      margin={false}
      onClick={() => void restore()}
      size="small"
    >
      {adminText(pending ? 'admin.restore.pending' : 'admin.restore')}
    </Button>
  );
}
