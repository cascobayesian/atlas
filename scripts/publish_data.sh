#!/bin/zsh
# Bundle data/ (written by Local.Political.Data/code/atlas/proto/01_export.R with ATLAS_OUT=<this repo>/data),
# replace the bundle on the "data" release, and republish the site.
set -euo pipefail
cd "${0:A:h}/.."
[[ -f data/places.json ]] || { echo "no data/places.json; run the export first" >&2; exit 1; }
tar -czf /tmp/atlas-data.tar.gz -C data .
ls -lh /tmp/atlas-data.tar.gz
gh release view data >/dev/null 2>&1 || gh release create data --title "Atlas data" --notes "Data bundle for the published atlas (replaced on each export)."
gh release upload data /tmp/atlas-data.tar.gz --clobber
gh workflow run publish.yml
echo "Uploaded; publishing. Watch with: gh run watch"
