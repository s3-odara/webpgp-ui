#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 0 ]; then
	echo "Usage: scripts/update-openpgpjs.sh" >&2
	exit 2
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
	echo "Run this script from the repository root" >&2
	exit 1
}
if [ "$(pwd -P)" != "$(cd "$repo_root" && pwd -P)" ] || [ ! -f site/app.mjs ]; then
	echo "Run this script from the repository root" >&2
	exit 1
fi

readonly OPENPGPJS_API_URL="https://api.github.com/repos/openpgpjs/openpgpjs/releases/latest"
readonly OPENPGPJS_REPOSITORY_URL="https://github.com/openpgpjs/openpgpjs.git"
readonly SIGNERS=$'twiss:72E33AE81300E553BC4EEDEFCB064A128FA90686\nlarabr:DDEBA5D26F64DC406368799F2A4BEC40729185DD'

workdir=$(mktemp -d "${TMPDIR:-/tmp}/webpgp-openpgpjs.XXXXXXXX")
trap 'rm -rf "$workdir"' EXIT

tag=$(
	curl --fail --silent --show-error --location "$OPENPGPJS_API_URL" |
		jq -er '.tag_name | strings'
)
tag_ref="refs/tags/$tag"
if ! git check-ref-format "$tag_ref"; then
	echo "Invalid OpenPGP.js tag ref: $tag_ref" >&2
	exit 1
fi

echo "Updating OpenPGP.js to $tag"

export GNUPGHOME="$workdir/gnupg"
mkdir -m 700 "$GNUPGHOME"
ownertrust_file="$workdir/ownertrust.txt"
: >"$ownertrust_file"

while IFS=: read -r username fingerprint; do
	key_file="$workdir/${username}.gpg"
	curl --fail --silent --show-error --location \
		"https://github.com/${username}.gpg" >"$key_file"

	if ! gpg --batch --with-colons --show-keys --fingerprint "$key_file" |
		awk -F: -v expected="$fingerprint" '
      $1 == "pub" { primary = 1; next }
      $1 == "sub" { primary = 0 }
      primary && $1 == "fpr" {
        if (toupper($10) == expected) found = 1
        primary = 0
      }
      END { exit !found }
    '; then
		echo "Expected primary fingerprint not found for $username: $fingerprint" >&2
		exit 1
	fi

	gpg --batch --import "$key_file"
	printf '%s:6:\n' "$fingerprint" >>"$ownertrust_file"
done <<<"$SIGNERS"

gpg --batch --import-ownertrust "$ownertrust_file"

source_dir="$workdir/openpgpjs"
git init --quiet "$source_dir"
git -C "$source_dir" remote add origin "$OPENPGPJS_REPOSITORY_URL"
git -C "$source_dir" fetch --quiet --no-tags --depth=1 origin \
	"${tag_ref}:${tag_ref}"

git -C "$source_dir" \
	-c gpg.program=gpg \
	-c gpg.minTrustLevel=ultimate \
	verify-tag "$tag_ref"

git -C "$source_dir" checkout --quiet --detach "$tag_ref"

(
	cd "$source_dir"
	npm ci --ignore-scripts
	npm audit signatures
	npm --ignore-scripts run prepare
	npm --ignore-scripts test
)

built_bundle="$source_dir/dist/openpgp.min.mjs"
upstream_license="$source_dir/LICENSE"
if [ ! -f "$built_bundle" ]; then
	echo "dist/openpgp.min.mjs not found after build" >&2
	exit 1
fi
if [ ! -f "$upstream_license" ]; then
	echo "OpenPGP.js LICENSE not found" >&2
	exit 1
fi

mkdir -p site/vendor
cp "$built_bundle" site/vendor/openpgp.min.mjs
cp "$upstream_license" site/vendor/LICENSE
printf '%s\n' "$tag" >site/vendor/openpgp.tag.txt
cat >site/vendor/openpgpjs.NOTICE <<EOF
OpenPGP.js
Source: https://github.com/openpgpjs/openpgpjs/tree/$tag
EOF

echo "Updated site/vendor to OpenPGP.js $tag"
