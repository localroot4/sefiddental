import { Pill } from '@payloadcms/ui';
import type { DefaultServerCellComponentProps } from 'payload';

import { adminText } from '@/i18n/fa-admin';

import styles from './bookings.module.css';
import { dayTime, isOverdue } from './format';

/** `kind`: emergencies carry the warning pill at the top of the list (R-10); red is for errors. */
export function KindCell({ cellData }: DefaultServerCellComponentProps) {
  return cellData === 'emergency' ? (
    <Pill pillStyle="warning" size="small">
      {adminText('admin.kind.emergency')}
    </Pill>
  ) : (
    <span>{cellData === 'regular' ? adminText('admin.kind.regular') : ''}</span>
  );
}

/** `callbackDueAt`: Tehran time, plus «گذشته» while the request still waits for a call. */
export function CallbackDueCell({ cellData, rowData }: DefaultServerCellComponentProps) {
  const text = dayTime(cellData);
  if (!text) return null;
  return (
    <span className={styles.time}>
      {text}
      {isOverdue(rowData?.status, cellData) ? (
        <Pill pillStyle="warning" size="small">
          {adminText('admin.cell.overdue')}
        </Pill>
      ) : null}
    </span>
  );
}

/** `receivedAt` (a UI field): when the request arrived, Tehran time. */
export function ReceivedAtCell({ rowData }: DefaultServerCellComponentProps) {
  const text = dayTime(rowData?.createdAt);
  return text ? <span className={styles.time}>{text}</span> : null;
}
