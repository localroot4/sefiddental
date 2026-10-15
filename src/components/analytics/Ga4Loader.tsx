'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const SCRIPT_ID = 'ga4-gtag';

/**
 * Loads Google's gtag.js after the `load` event (conversion.md 9): no inline script (the CSP
 * nonce plus 'strict-dynamic' trusts a script this bundle inserts), nothing before the page is
 * done, one script per page life. track() sends to window.gtag once it exists. A blocked or
 * failed script is silent: the first-party counter stays the source of truth.
 */
export function Ga4Loader({ id }: { id: string }): null {
  useEffect(() => {
    const start = () => {
      if (document.getElementById(SCRIPT_ID)) return;
      const dataLayer = (window.dataLayer ??= []);
      window.gtag = function gtag() {
        // Google's tag snippet: gtag.js reads each queued arguments object, not an array.
        // eslint-disable-next-line prefer-rest-params
        dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', id);
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.append(script);
    };
    if (document.readyState === 'complete') {
      start();
      return;
    }
    window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, [id]);
  return null;
}
