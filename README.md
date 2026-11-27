# Atlas of US Voting Blocs

Voting blocs in 38 US states and cities, inferred from precinct-level ballot questions and races with a
beta-binomial mixture model. Live at <https://cascobayesian.github.io/atlas/>.

Each place's panel (rotating PCA, bloc list, map, referendum heatmap, demographic and profile subpanels) is drawn
in the browser from data, with MapLibre and PMTiles for the maps.

- `index.html`, `assets/` — the page and its code. `?place=<key>` picks a place.
- `data/<key>/` and `assets/world/` — the data and the world page's figures. Not in git and not in the GitHub Pages
  deploy: they are served from the Cloudflare R2 bucket `atlas-data`, at <https://votingblocatlas.org/>, which mirrors
  these paths. `assets/host.js` holds that address; the pages fetch through its `atlasData(path)`. Add `?localdata`
  to any page's URL to read them from the local checkout instead.
  `data/` is written by `code/atlas/proto/01_export.R` in the Local.Politics project and the country exporters
  (`ATLAS_OUT=<this repo>/data`); `assets/world/` figures are copied from the country projects.

### Publishing

- **Code and pages:** commit and push to `main`. The Publish workflow deploys them (a few tens of MB).
- **A place's data:** `scripts/publish_place.sh <key> [<key> ...]` mirrors `data/<key>/` to the bucket (only changed
  files; files removed locally are removed there) and uploads `data/places.json`. `--world` does `assets/world/`,
  `--all` does everything. Visitors see the new files within ten minutes (cache lifetime). Nothing is redeployed.
- **Adding a country:** export to `data/<key>/` (and figures to `assets/world/`), `scripts/publish_place.sh <key>`
  (and `--world`), then add it to `assets/world_countries.js` / `assets/countries/` and push.
- Needs `rclone` (here `~/bin/rclone`) with a remote `r2` (`rclone config`: s3, provider Cloudflare, the R2 S3 API
  endpoint without the bucket name, an Object Read & Write token for the bucket, `no_check_bucket = true`).
- Animations play as looping MP4s, not GIFs: `scripts/gif2mp4.sh` converts every GIF newer than its `.mp4` (needs
  ffmpeg, or `pip install imageio-ffmpeg`); `publish_place.sh` runs it and never uploads GIFs.
- Bucket settings, in the Cloudflare dashboard (R2 → atlas-data → Settings): the custom domain, and a CORS policy
  allowing GET/HEAD from `https://cascobayesian.github.io` (and `http://localhost:8765` for testing) with the
  `Range` header, exposing `Content-Range`, `Content-Length`, `ETag` and `Accept-Ranges`.
- `scripts/publish_data.sh` (the old single bundle on the `data` release) is retired; the release is kept as a backup.
