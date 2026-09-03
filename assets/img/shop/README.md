# Product photography

Drop a product photo here and reference it from `data/products.json` as
`"image": "/assets/img/shop/<file>"`.

The build only renders the path once the file is actually on disk
(`loadShop()` in `src/data.mjs` checks), so a product can be listed before its
photo exists without producing a broken image. Until then the product page
falls back to a library photo, captioned as illustrative.

Expected for the current catalogue:

- `aventon-soltera-2-5.jpg` — Aventon Soltera 2.5
