# Atlas of US Voting Blocs

Voting blocs in 38 US states and cities, inferred from precinct-level ballot questions and races with a
beta-binomial mixture model. Live at <https://cascobayesian.github.io/atlas/>.

Each place's panel (rotating PCA, bloc list, map, referendum heatmap, demographic and profile subpanels) is drawn
in the browser from data, with MapLibre and PMTiles for the maps.

- `index.html`, `assets/` — the page and its code. `?place=<key>` picks a place.
- `data/` — not in git. Written by `code/atlas/proto/01_export.R` in the Local.Politics project
  (`ATLAS_OUT=<this repo>/data`, with `SITE_DIR` set to a checkout of the site that has `files/images/research/atlas-fused/`), bundled and uploaded by `scripts/publish_data.sh` to the `data` release.
  The Publish workflow combines the two on every push or upload.

Animations are played as looping MP4s, not GIFs: `scripts/gif2mp4.sh` converts every `assets/world/*.gif` and
`data/*/gifs/*.gif` that is newer than its `.mp4` (needs ffmpeg, or `pip install imageio-ffmpeg`). Run it before
committing new `assets/world` figures; `publish_data.sh` runs it itself. The GIFs stay local (git and the bundle skip them).

To serve the data from elsewhere (e.g. a Cloudflare R2 bucket), set `data-data` on `#ap` in `index.html`
to that bucket's URL.
