#!/bin/zsh
# Re-encode the atlas's animated GIFs as looping H.264 MP4s (about a fifth of the size), next to each GIF:
# assets/world/*.gif and data/*/gifs/*.gif.  The pages play the .mp4; the GIFs stay local only
# (.gitignore keeps assets/world/*.gif out of git, publish_data.sh leaves data/**/*.gif out of the bundle).
# Only GIFs newer than their MP4 are converted, so it is cheap to run before every commit or data upload.
#
#   scripts/gif2mp4.sh            # everything
#   scripts/gif2mp4.sh FILE.gif…  # just these
#
# ffmpeg: $FFMPEG, else ffmpeg on the PATH, else the binary of the imageio-ffmpeg Python package (pip install imageio-ffmpeg).
set -euo pipefail
cd "${0:A:h}/.."
ff=${FFMPEG:-$(command -v ffmpeg || python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())" 2>/dev/null || true)}
[[ -x "$ff" ]] || { echo "no ffmpeg: brew install ffmpeg, or pip install imageio-ffmpeg, or set FFMPEG" >&2; exit 1; }
if (( $# )); then gifs=("$@"); else gifs=(assets/world/*.gif(N) data/*/gifs/*.gif(N)); fi
n=0
for g in $gifs; do
  m=${g%.gif}.mp4
  [[ -f $m && $m -nt $g ]] && continue
  # crf 24: no visible loss on the rotating point clouds; even dimensions for yuv420p; faststart so it plays while loading
  "$ff" -loglevel error -y -i $g -an -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart $m.tmp.mp4 && mv $m.tmp.mp4 $m
  printf '%-50s %6s -> %6s\n' $g $(du -h $g | cut -f1) $(du -h $m | cut -f1); n=$((n + 1))
done
echo "$n converted"
