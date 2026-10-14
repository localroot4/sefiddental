# Deploy

Status: draft. The hosting path waits for the client (gap 32, brief decision
21). This file holds the rules that apply to every path; the chosen-path
steps come after the client confirms the path.

## Reverse proxy or TLS terminator (every path)

The app sets the static security headers itself (`next.config.ts`
`headers()`), and the proxy (`src/proxy.ts`) adds the route-dependent ones.
One response kind is out of the app's reach, so the reverse proxy in front of
Node must also set the static set.

1. Set these headers on every response, error responses included (nginx:
   `add_header ... always`). Hide the copies that Node sends
   (nginx: `proxy_hide_header`), so each header appears once.

   | Header | Value |
   |---|---|
   | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
   | `X-Content-Type-Options` | `nosniff` |
   | `Referrer-Policy` | `strict-origin-when-cross-origin` |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

   Why: Next.js 16.4 answers a path that contains `//` or `\` with its own
   308 before `headers()` and the proxy run (`base-server.js`
   `handleRequestImpl`). That 308 carries none of the headers above. It is
   the one exception to "security headers on every response" in the app
   (e2e T-CN2b pins it).

2. Remove the `x-middleware-*` response headers (nginx:
   `proxy_hide_header x-middleware-rewrite;`). A Persian dynamic page answers
   with `x-middleware-rewrite: /r/services/<slug>`, which names the internal
   ASCII route. The internal path itself answers the branded 404, so this
   leaks no content; removing the header is hardening only. Keep
   `x-nextjs-rewritten-path` and `x-nextjs-rewritten-query`: the App Router
   client reads them during client navigation.
