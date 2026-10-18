/**
 * The GA4 bootstrap served at /ga4.js (conversion.md 9, freeze G16). The site layout renders its
 * tag, with the CSP nonce, only while an admin has GA4 on, so no page ships GA code otherwise
 * (a client component would be in every page's bundle). After `load` it queues the 'js' and
 * 'config' commands and inserts Google's gtag.js once: 'strict-dynamic' trusts a script that a
 * nonce'd script inserts. No inline script. The id is checked again here. track() sends to
 * window.gtag once it exists; a blocked or failed gtag.js is silent.
 */
export const GA4_BOOT = `(function () {
  var tag = document.querySelector('script[data-ga4-id]');
  var id = tag && tag.getAttribute('data-ga4-id');
  if (!id || !/^G-[A-Z0-9]{4,}$/.test(id)) return;
  function start() {
    if (document.getElementById('ga4-gtag')) return;
    var dataLayer = (window.dataLayer = window.dataLayer || []);
    window.gtag = function () {
      dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', id);
    var script = document.createElement('script');
    script.id = 'ga4-gtag';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
`;
