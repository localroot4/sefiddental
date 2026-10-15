/** vCard 3.0 text escaping (RFC 2426 5.8.4): backslash, comma, semicolon, newline. */
const esc = (value: string) => value.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

/**
 * «ذخیرهٔ شمارهٔ کلینیک» (conversion.md 5.4 item 4): name, phones (the caller number first, so
 * the reception's call is recognised), address and site, as a data: URL for a download link.
 */
export function clinicVcardHref(clinic: {
  name: string;
  phones: string[];
  street: string;
  city: string;
  site: string;
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(clinic.name)}`,
    `ORG:${esc(clinic.name)}`,
    ...[...new Set(clinic.phones.filter(Boolean))].map((tel) => `TEL;TYPE=WORK,VOICE:${tel}`),
    `ADR;TYPE=WORK:;;${esc(clinic.street)};${esc(clinic.city)};;;IR`,
    `URL:${clinic.site}`,
    'END:VCARD',
    '',
  ];
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}
