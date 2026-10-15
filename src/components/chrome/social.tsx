import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icons';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import type { EventLocation } from '@/lib/events/allowlist';
import type { FooterData } from '@/lib/data/footer';

const NETWORK = {
  instagram: { icon: 'instagram', label: 'nav.instagram' },
  telegramChannel: { icon: 'telegram', label: 'nav.telegram' },
  aparat: { icon: null, label: 'nav.aparat' },
} as const satisfies Record<
  FooterData['social'][number]['network'],
  { icon: IconName | null; label: Parameters<typeof t>[0] }
>;

/** wa.me link with the generic prefill (conversion.md 8); the number without "+". */
export function whatsappHref(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(t('nav.whatsappText'))}`;
}

/**
 * The clinic's social profiles and, once verified (F12), WhatsApp as 44 px icon buttons (drawer
 * foot, footer). A network without a glyph (Aparat) is a text link. Nothing renders without data.
 */
export function SocialLinks(props: {
  social: FooterData['social'];
  whatsapp: string | null;
  location: EventLocation;
}) {
  return (
    <>
      {props.social.map(({ network, url }) => {
        const { icon, label } = NETWORK[network];
        return icon ? (
          <IconButton key={network} href={url} label={t(label)} icon={<Icon name={icon} />} />
        ) : (
          <TextLink key={network} href={url} standalone className="text-small">
            {t(label)}
          </TextLink>
        );
      })}
      {props.whatsapp ? (
        <IconButton
          href={whatsappHref(props.whatsapp)}
          label={t('nav.whatsapp')}
          icon={<Icon name="whatsapp" />}
          track={{ event: 'whatsapp_click', location: props.location }}
        />
      ) : null}
    </>
  );
}
