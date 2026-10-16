import type { DefaultServerCellComponentProps, UIFieldServerProps } from 'payload';

import { adminText } from '@/i18n/fa-admin';
import { formatPhoneFa, maskPhone, parseIranPhone, telHref } from '@/lib/phone';

import styles from './bookings.module.css';

/**
 * Click-to-call and WhatsApp to the patient (admin-notify.md 4.2). The full number is already
 * readable by staff; labels name it masked. WhatsApp only to a verified request: a valid Iranian
 * mobile on a row that is not suspicious or spam (a bot may type a stranger's number; staff call
 * first and restore it), with no prefill text (the clinic's public prefill is for its own number).
 */
function ContactLinks({ phone, whatsapp }: { phone: string; whatsapp: boolean }) {
  const parsed = parseIranPhone(phone, { accept: 'mobile' });
  if (!parsed.ok) return null;
  const masked = maskPhone(parsed.e164);
  return (
    <span className={styles.contact}>
      <a
        className={styles.contactLink}
        href={telHref(parsed.e164)}
        aria-label={adminText('admin.contact.callAria', { phone: masked })}
      >
        {adminText('admin.contact.call')}
      </a>
      {whatsapp ? (
        <a
          className={styles.contactLink}
          href={`https://wa.me/${parsed.e164.slice(1)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={adminText('admin.contact.whatsappAria', { phone: masked })}
        >
          {adminText('admin.contact.whatsapp')}
        </a>
      ) : null}
    </span>
  );
}

const phoneOf = (row: unknown): string | null => {
  const phone = (row as { phone?: unknown } | null | undefined)?.phone;
  return typeof phone === 'string' && phone !== '' ? phone : null;
};

const UNVERIFIED = new Set(['suspicious', 'spam']);
const verified = (row: unknown) =>
  !UNVERIFIED.has(String((row as { status?: unknown } | null | undefined)?.status));

/** List column «تماس با بیمار». */
export function ContactCell({ rowData }: DefaultServerCellComponentProps) {
  const phone = phoneOf(rowData);
  return phone ? <ContactLinks phone={phone} whatsapp={verified(rowData)} /> : null;
}

/** Sidebar block of a saved request: the number in an LTR island, then the two links. */
export function ContactField({ data }: UIFieldServerProps) {
  const phone = phoneOf(data);
  if (!phone || !parseIranPhone(phone, { accept: 'mobile' }).ok) return null;
  return (
    <div className={styles.contactField}>
      <span className={styles.label}>{adminText('admin.contact.label')}</span>
      <bdi dir="ltr" className={styles.phone}>
        {formatPhoneFa(phone)}
      </bdi>
      <ContactLinks phone={phone} whatsapp={verified(data)} />
    </div>
  );
}
