#!/usr/bin/env bash
set -euo pipefail

tag="${OPENPGPJS_TAG:-}"
version="${OPENPGPJS_VERSION:-}"

if [ -z "$tag" ] || [ -z "$version" ]; then
  echo "OPENPGPJS_TAG and OPENPGPJS_VERSION must be set" >&2
  exit 1
fi

export GNUPGHOME
GNUPGHOME=$(mktemp -d "$RUNNER_TEMP/gnupg.XXXXXX")
chmod 700 "$GNUPGHOME"

declare -a allowed_signer_fprs=()

while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  username=${entry%%:*}
  fpr=${entry#*:}
  if [ -z "$username" ] || [ -z "$fpr" ]; then
    echo "Invalid OPENPGPJS_SIGNER_FPRS entry: $entry" >&2
    exit 1
  fi
  if ! printf '%s' "$fpr" | grep -Eq '^[0-9A-Fa-f]{40}$'; then
    echo "Invalid fingerprint format for $username: $fpr" >&2
    exit 1
  fi
  fpr=${fpr^^}
  allowed_signer_fprs+=("$fpr")
  keyfile="$RUNNER_TEMP/${username}.gpg"
  curl -fsSL "https://github.com/${username}.gpg" \
    | sed 's/-----END PGP PUBLIC KEY BLOCK-----/-----END PGP PUBLIC KEY BLOCK-----\n/g' \
    > "$keyfile"
  gpg --batch --import "$keyfile"
done <<EOF_FPRS
${OPENPGPJS_SIGNER_FPRS:-}
EOF_FPRS

if [ "${#allowed_signer_fprs[@]}" -eq 0 ]; then
  echo "OPENPGPJS_SIGNER_FPRS must contain at least one signer" >&2
  exit 1
fi

ownertrust_file="$RUNNER_TEMP/openpgpjs-ownertrust.txt"
: > "$ownertrust_file"
for fpr in "${allowed_signer_fprs[@]}"; do
  if ! gpg --batch --with-colons --fingerprint \
    | awk -F: -v expected="$fpr" '
        $1 == "pub" { primary = 1; next }
        primary && $1 == "fpr" {
          if (toupper($10) == expected) found = 1
          primary = 0
        }
        END { exit !found }
      '; then
    echo "Expected primary fingerprint not found in downloaded keys: $fpr" >&2
    exit 1
  fi
  printf '%s:6:\n' "$fpr" >> "$ownertrust_file"
done

if ! gpg --batch --import-ownertrust "$ownertrust_file"; then
  echo "Failed to assign ultimate ownertrust to allowed signing keys" >&2
  exit 1
fi

git init openpgpjs-src
cd openpgpjs-src
git remote add origin https://github.com/openpgpjs/openpgpjs.git
git fetch --depth=1 origin "refs/tags/${tag}:refs/tags/${tag}"
if ! git -c gpg.program=gpg -c gpg.minTrustLevel=ultimate verify-tag "${tag}"; then
  echo "Tag signature verification at ultimate trust failed for ${tag}" >&2
  exit 1
fi

git checkout -q "${tag}"

npm ci
npm audit signatures
npm test

cd ..
mkdir -p build_artifact
if [ ! -f "openpgpjs-src/dist/openpgp.min.mjs" ]; then
  echo "dist/openpgp.min.mjs not found after build" >&2
  exit 1
fi
cp "openpgpjs-src/dist/openpgp.min.mjs" build_artifact/openpgp.min.mjs
printf '%s\n' "$version" > build_artifact/openpgp.version.txt
