#!/bin/zsh
# Bundle data/ (written by Local.Political.Data/code/atlas/proto/01_export.R and the country exporters with
# ATLAS_OUT=<this repo>/data), upload it to the "data" release, and republish the site.
# The bundle goes up in 90 MB parts named atlas-data.<stamp>.part-aa, -ab, ..., then a marker atlas-data.<stamp>.complete;
# the Publish workflow uses the newest set with a marker. A single ~550 MB upload stalls on slower connections (HTTP 408),
# a failed part is retried alone, and older sets are deleted only after the new one is complete, so a failed upload
# leaves the release (and the next deploy) on the previous bundle.
set -euo pipefail
cd "${0:A:h}/.."
[[ -f data/places.json ]] || { echo "no data/places.json; run the export first" >&2; exit 1; }
stamp=atlas-data.$(date -u +%Y%m%dT%H%M%SZ); tmp=$(mktemp -d)
tar -czf $tmp/bundle.tar.gz -C data .
ls -lh $tmp/bundle.tar.gz
(cd $tmp && shasum -a 256 bundle.tar.gz > $stamp.complete && split -b 90m -a 2 bundle.tar.gz $stamp.part- && rm bundle.tar.gz)   # marker holds the checksum
gh release view data >/dev/null 2>&1 || gh release create data --title "Atlas data" --notes "Data bundle for the published atlas (replaced on each export)."
new=(${(f)"$(cd $tmp && ls $stamp.part-*)"} $stamp.complete)     # the marker goes last
for f in $new; do
  for i in 1 2 3 4 5; do gh release upload data $tmp/$f --clobber && break
    [[ $i == 5 ]] && { echo "upload of $f failed; the release still serves the previous complete bundle" >&2; exit 1 }
    echo "retrying $f" >&2; sleep 5; done
done
for a in ${(f)"$(gh release view data --json assets --jq '.assets[].name')"}; do   # drop every older set
  (( ${new[(Ie)$a]} )) || gh release delete-asset data $a --yes
done
rm -rf $tmp
gh workflow run publish.yml
echo "Uploaded $stamp (${#new} files); publishing. Watch with: gh run watch"
