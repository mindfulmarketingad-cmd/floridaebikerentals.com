# Security

FloridaEbikeRentals.com is a static site. That decision is the security posture: there is no
application server, no database, no user accounts, no sessions, no file uploads and no
server-side code path an attacker can reach. What ships is HTML, CSS, one JavaScript file and
images.

## What that removes

No SQL injection, no server-side template injection, no authentication bypass, no session
hijacking, no vulnerable CMS plugins, no admin login page to brute force, and no dependency
supply chain — the build uses only the Node standard library and the runtime pulls in no
third-party JavaScript.

## What is actively defended

**Cross-site scripting.** Every value from the Outscraper import is untrusted text. It is
HTML-escaped at render time by `esc()` in `src/util.mjs`, and JSON embedded in attributes and
JSON-LD is escaped again for its context. Front-end code writes dynamic values with
`textContent` and `setAttribute`, never `innerHTML`, so neither scraped data nor a value from
the URL bar can become markup. The Markdown renderer escapes raw HTML in source files.

**Content Security Policy.** Every page carries its own CSP with a SHA-256 hash for each
inline script it contains, so no other inline script executes. `default-src 'self'`,
`object-src 'none'`, `base-uri 'self'`, and image, script, frame and connect sources are
limited to the specific hosts the site needs: Google's image CDN for listing photos,
OpenStreetMap for map tiles, and Google's ad hosts when AdSense is enabled.

**Malicious URLs in imported data.** The importer drops any website or link value that is not
`http`/`https`, so a `javascript:` or `data:` URL in a scraped record never reaches a page.
Outbound links carry `rel="nofollow noopener"`.

**Transport and framing.** `dist/_headers`, `vercel.json` and `dist/.htaccess` set HSTS with
preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (clickjacking),
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` that
allows geolocation only for this origin, `Cross-Origin-Opener-Policy: same-origin` and
`X-Permitted-Cross-Domain-Policies: none`. The `.htaccess` also forces HTTPS, forces the
canonical host and disables directory indexing.

**Privacy of visitor location.** The "rentals near me" feature calls the browser geolocation
API, which always prompts for permission. Coordinates are used inside the visitor's browser to
sort listings and are never transmitted or stored.

**Contact form.** With no endpoint configured, the form composes a message in the visitor's own
email client — nothing is posted anywhere. A honeypot field and input length limits are in
place for when an endpoint is configured. The form never asks for credentials or payment data.

## Deployment checklist

1. Serve over HTTPS only, with HTTP redirected — the host config files do this.
2. Confirm the security headers arrive: `curl -sI https://floridaebikerentals.com | sort`.
3. Keep DNS registrar and host accounts on multi-factor authentication. On a static site,
   those accounts are the realistic attack surface.
4. Rebuild and redeploy from source rather than editing files on the server.

## Reporting a vulnerability

Email the address in `/.well-known/security.txt` or use the
[contact page](https://floridaebikerentals.com/contact/). Please include steps to reproduce.
