'use client';

import { Button, toast, useFormModified } from '@payloadcms/ui';
import { useState } from 'react';

import styles from '@/admin/bookings/bookings.module.css';
import { adminText } from '@/i18n/fa-admin';

/**
 * «ارسال پیام آزمایشی» beside the notifier's save button (admin-notify.md 9.8). It tests the
 * saved switches, so it waits until the form has no unsaved change; the answer names each
 * channel's result, as an error when a switched-on channel did not send.
 */
export function NotifierTestButton() {
  const modified = useFormModified();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      const response = await fetch('/api/globals/notifier/test', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        level?: 'error' | 'success' | 'info';
      } | null;
      if (response.ok && body?.message) toast[body.level ?? 'info'](body.message);
      else toast.error(body?.message ?? adminText('admin.network'));
    } catch {
      toast.error(adminText('admin.network'));
    } finally {
      setPending(false);
    }
  };
  return (
    <span className={styles.testAction}>
      <Button
        buttonStyle="secondary"
        className={styles.action}
        disabled={pending || modified}
        extraButtonProps={modified ? { 'aria-describedby': 'notifier-test-hint' } : undefined}
        id="notifier-test"
        margin={false}
        onClick={() => void run()}
        size="medium"
      >
        {adminText(pending ? 'admin.notifier.testPending' : 'admin.notifier.test')}
      </Button>
      {modified ? (
        <span id="notifier-test-hint" className={styles.hint}>
          {adminText('admin.notifier.unsaved')}
        </span>
      ) : null}
    </span>
  );
}
