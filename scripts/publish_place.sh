#!/bin/zsh
# Upload the atlas data to the Cloudflare R2 bucket that serves it (see README): one place at a time, only what changed.
# The bucket mirrors the site's own paths, data/<key>/... and assets/world/..., so the pages only swap the host.
#
#   scripts/publish_place.sh canada serbia     # these places' data/<key>/ (and data/places.json)
#   scripts/publish_place.sh --world           # assets/world/ (the world page's figures)
#   scripts/publish_place.sh --all             # every place in data/, and assets/world/
#
# GIFs are converted to MP4 first (scripts/gif2mp4.sh) and never uploaded.  A place's folder is mirrored exactly:
# files deleted locally are deleted in the bucket too.  Nothing is rebuilt or redeployed; the pages read the bucket directly.
#
# Needs rclone with a remote named r2 (rclone config: s3, provider Cloudflare, no_check_bucket = true).
# RCLONE overrides the binary (default: rclone on the PATH, else ~/bin/rclone); BUCKET overrides r2:atlas-data.
set -euo pipefail
cd "${0:A:h}/.."
rc=${RCLONE:-$(command -v rclone || echo ~/bin/rclone)}
[[ -x $rc ]] || { echo "no rclone (see README)" >&2; exit 1; }
bucket=${BUCKET:-r2:atlas-data}
(( $# )) || { sed -n '4,7p' $0 >&2; exit 1; }

# a re-export reaches visitors within ten minutes (the Cloudflare cache and browsers keep a file that long)
opts=(--exclude "*.gif" --exclude ".DS_Store" --exclude "*.tmp.mp4" --transfers 8 --checkers 16 --fast-list
      --header-upload "Cache-Control: public, max-age=600" --stats-one-line --stats 30s -v)

places=(); world=0
for a in "$@"; do
  case $a in
    --all) places=(data/*/(N:t)); world=1 ;;
    --world) world=1 ;;
    *) [[ -d data/$a ]] || { echo "no data/$a" >&2; exit 1; }; places+=($a) ;;
  esac
done

if (( ${#places} )); then
  gifs=(${^places/#/data/}/gifs/*.gif(N)); (( ${#gifs} )) && scripts/gif2mp4.sh $gifs
  for k in $places; do echo "== data/$k"; $rc sync data/$k $bucket/data/$k $opts; done
  $rc copyto data/places.json $bucket/data/places.json --header-upload "Cache-Control: public, max-age=600"
fi
if (( world )); then
  gifs=(assets/world/*.gif(N)); (( ${#gifs} )) && scripts/gif2mp4.sh $gifs
  echo "== assets/world"; $rc sync assets/world $bucket/assets/world $opts
fi
echo "done"
