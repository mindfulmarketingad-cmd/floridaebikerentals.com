# Site improvements log

One small UX / speed / SEO improvement a day. Newest first. Check here before picking the next one
so nothing is done twice.

| Date | Area | Change | Files |
| --- | --- | --- | --- |
| 2026-10-30 | SEO / internal linking | City tour pages (`/tours/<town>/`) gain a "Plan your ride in <town>" block linking to the site's own guides for that town: blog posts tagged with the town name, plus trail and cost guides that list the town in `towns`. Turns the Viator listicles from affiliate dead ends into entry points to original writing (e.g. `/tours/sarasota/` -> Legacy Trail guide, `/tours/naples/` -> Naples e-bike rules, `/tours/key-west/` -> Key West guide). | `src/pages/tours.mjs` (`localGuides`) |

## Earlier work (before this log)

- 2026-10-29: Broken Viator tour photos fixed (Viator redirect CDN allowed in CSP) and a branded fallback image (`/assets/img/tour-fallback.svg`) for any tour image that fails to load.
- 2026-10-29: `/tours/` restored as a static Viator browse page with town tour guides and a homepage carousel; tour pages in `sitemap-tours.xml`.
