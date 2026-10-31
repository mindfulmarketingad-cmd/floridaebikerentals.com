# Site improvements log

One small UX / speed / SEO improvement a day. Newest first. Check here before picking the next one
so nothing is done twice.

| Date | Area | Change | Files |
| --- | --- | --- | --- |
| 2026-10-31 | SEO / titles (review fix #8) | Listing `<title>`s trim keyword lists out of raw Google Business names: the name is cut back at separators (` \| `, ` - `, ` / `, `: `, ` (`, ` @ `, a leading comma) and the longest version that fits 70 characters with the town is used, never cutting mid-phrase; clashes fall back to the longer distinct name. 41 of 537 indexable listing titles changed (e.g. `Surf N Turf: Reviews & Hours - Miramar Beach, FL`); titles over 70 chars 90 -> 54, longest 134 -> 97, all unique. H1s and page copy keep the full name. | `src/data.mjs` (`titleNames`, `assignTitles`) |
| 2026-10-30 | SEO / internal linking | City tour pages (`/tours/<town>/`) gain a "Plan your ride in <town>" block linking to the site's own guides for that town: blog posts tagged with the town name, plus trail and cost guides that list the town in `towns`. Turns the Viator listicles from affiliate dead ends into entry points to original writing (e.g. `/tours/sarasota/` -> Legacy Trail guide, `/tours/naples/` -> Naples e-bike rules, `/tours/key-west/` -> Key West guide). | `src/pages/tours.mjs` (`localGuides`) |

## Earlier work (before this log)

- 2026-10-29: Broken Viator tour photos fixed (Viator redirect CDN allowed in CSP) and a branded fallback image (`/assets/img/tour-fallback.svg`) for any tour image that fails to load.
- 2026-10-29: `/tours/` restored as a static Viator browse page with town tour guides and a homepage carousel; tour pages in `sitemap-tours.xml`.
