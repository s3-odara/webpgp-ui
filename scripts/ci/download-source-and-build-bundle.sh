#!/usr/bin/env bash
set -euo pipefail

tag="${OPENPGPJS_TAG:-}"
version="${OPENPGPJS_VERSION:-}"

if [ -z "$tag" ] || [ -z "$version" ]; then
  echo "OPENPGPJS_TAG and OPENPGPJS_VERSION must be set" >&2
  exit 1
fi

export GNUPGHOME="$RUNNER_TEMP/gnupg"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"

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
  keyfile="$RUNNER_TEMP/${username}.gpg"
  curl -fsSL "https://github.com/${username}.gpg" \
    | sed 's/-----END PGP PUBLIC KEY BLOCK-----/-----END PGP PUBLIC KEY BLOCK-----\n/g' \
    > "$keyfile"
  gpg --batch --import "$keyfile"
  if ! gpg --batch --with-colons --fingerprint \
    | awk -F: '$1=="fpr"{print $10}' \
    | grep -Fx "$fpr" >/dev/null; then
    echo "Expected fingerprint not found for $username: $fpr" >&2
    exit 1
  fi
done <<EOF_FPRS
${OPENPGPJS_SIGNER_FPRS:-}
EOF_FPRS

git init openpgpjs-src
cd openpgpjs-src
git remote add origin https://github.com/openpgpjs/openpgpjs.git
git fetch --depth=1 origin "refs/tags/${tag}:refs/tags/${tag}"
git -c gpg.program=gpg verify-tag "${tag}"
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
