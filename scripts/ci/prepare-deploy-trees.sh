#!/usr/bin/env bash
set -euo pipefail

rm -rf build_site_plain build_site__br
mkdir -p build_site_plain build_site__br
rsync -a --delete site/ build_site_plain/

# brotli 対象リスト
find build_site_plain -type f -regextype posix-extended -iregex "${BROTLI_REGEX}" -printf '%P\n' \
  | LC_ALL=C sort > brotli_file_list.txt

# __br に圧縮して同名で生成
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  src="build_site_plain/$rel"
  dst="build_site__br/$rel"
  mkdir -p "$(dirname "$dst")"
  brotli -f -q 11 -o "$dst" "$src"
done < brotli_file_list.txt
