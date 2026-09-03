# Product photography

Drop a product photo here and reference it from `data/products.json` as
`"image": "/assets/img/shop/<file>"`, alongside its real `imageWidth` and
`imageHeight` so the tile reserves the right space while loading.

The build only renders the path once the file is actually on disk
(`loadShop()` in `src/data.mjs` checks), so a product can be listed before its
photo exists without producing a broken image.

Resize to about 1000px on the long edge before committing, and flatten any
transparency onto white — the tiles have a white background.

## Currently in place

E-Bikes (`/shop/electric-bikes/`)

- `fat-tire-moped-ebike.jpg`
- `jasion-52v-fat-tire-ebike.jpg`
- `electric-dirt-bike.jpg`

E-Scooters (`/shop/electric-scooters/`)

- `razor-e90-electric-scooter.jpg`
- `segway-ninebot-max-g3.jpg`

## Still needed

Each collection is meant to hold twelve listings in a four-across grid, so:

- E-Bikes needs 9 more photos
- E-Scooters needs 10 more photos
- E-Skateboards needs 12 photos — nothing is listed there yet

Add each one to `data/products.json` with `"affiliate": true`, the collection's
affiliate `url`, and `"cta": "Check Price"`. Affiliate entries get no detail
page and are excluded from the sitemap and search index by design.
