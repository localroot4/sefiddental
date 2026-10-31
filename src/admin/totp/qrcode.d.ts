// shortcut: only the call the setup view makes; upgrade to @types/qrcode if more is needed.
declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: { margin?: number; width?: number; color?: { dark?: string; light?: string } },
  ): Promise<string>;
}
