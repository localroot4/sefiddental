'use client';

import {
  Button,
  ConfirmationModal,
  toast,
  useConfig,
  useModal,
  useSelection,
} from '@payloadcms/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { mergeListSearchAndWhere } from 'payload/shared';
import { useState } from 'react';

import { adminText } from '@/i18n/fa-admin';
import { formatNumberFa } from '@/lib/persianText';

import styles from './bookings.module.css';
import { bulkSpamMessage, errorMessage } from './format';
import { focusCurrentTab } from './tabs';

interface BulkResult {
  docs?: unknown[];
  errors?: unknown[];
}

const CONFIRM_SLUG = 'bookings-bulk-spam-confirm';

/**
 * Bulk «علامت هرزنامه» (freeze G15, D-7), in `beforeListTable` because only that slot renders
 * inside the list's selection provider. One REST bulk update with the selection as its `where`:
 * per-record hooks still apply the status table, so moves an editor may not make are refused
 * and counted. A confirm step names the count first, as Payload's own bulk delete does.
 */
export function BulkSpam() {
  const { count, getQueryParams, toggleAll } = useSelection();
  const { getEntityConfig } = useConfig();
  const { openModal } = useModal();
  const search = useSearchParams().get('search');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  if (count === 0) return null;

  const run = async () => {
    setPending(true);
    // "Select all" sends only the URL filter: add the search box as Payload's own bulk edit and
    // delete do, or every booking the filter matches would change, not the rows the list shows.
    const searchWhere = search
      ? mergeListSearchAndWhere({
          collectionConfig: getEntityConfig({ collectionSlug: 'bookings' }),
          search,
        })
      : undefined;
    try {
      const response = await fetch(`/api/bookings${getQueryParams(searchWhere)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'spam' }),
      });
      const body = (await response.json().catch(() => null)) as BulkResult | null;
      // A bulk answer (200, or 400 when some rows were refused) lists docs; anything else is an error.
      if (!Array.isArray(body?.docs)) {
        toast.error(errorMessage(body));
        setPending(false);
        return;
      }
      const refused = body.errors?.length ?? 0;
      const message = bulkSpamMessage(body.docs.length, refused);
      if (refused > 0) toast.warning(message);
      else toast.success(message);
      // The bar leaves with the selection: focus goes to the tabs, not to the page start.
      toggleAll();
      router.refresh();
      focusCurrentTab();
    } catch {
      toast.error(adminText('admin.network'));
      setPending(false);
    }
  };

  return (
    <div className={styles.bulk} role="group" aria-label={adminText('admin.bulk.spam')}>
      <p>{adminText('admin.bulk.selected', { n: formatNumberFa(count) })}</p>
      <Button
        buttonStyle="secondary"
        className={styles.action}
        disabled={pending}
        id="bookings-bulk-spam"
        margin={false}
        onClick={() => openModal(CONFIRM_SLUG)}
        size="medium"
      >
        {adminText(pending ? 'admin.bulk.pending' : 'admin.bulk.spam')}
      </Button>
      <ConfirmationModal
        body={adminText('admin.bulk.confirm', { n: formatNumberFa(count) })}
        confirmingLabel={adminText('admin.bulk.pending')}
        confirmLabel={adminText('admin.bulk.spam')}
        heading={adminText('admin.bulk.spam')}
        modalSlug={CONFIRM_SLUG}
        onConfirm={run}
      />
    </div>
  );
}
