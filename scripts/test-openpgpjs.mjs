import { readFile } from 'node:fs/promises';

import * as openpgp from '../site/vendor/openpgp.min.mjs';

const publicKeyBinary = await readFile(
  new URL('../site/odara_pgpkey_PUBLIC.pgp', import.meta.url)
);

const tag = (
  await readFile(
    new URL('../site/vendor/openpgp.tag.txt', import.meta.url),
    'utf8'
  )
).trim();

if (!tag) {
  throw new Error('site/vendor/openpgp.tag.txt is empty');
}

const encryptionKey = await openpgp.readKey({
  binaryKey: publicKeyBinary
});

const message = await openpgp.createMessage({
  text: 'webpgp-ui OpenPGP.js smoke test'
});

const encryptionConfig = {
  preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
  preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
  aeadProtect: true,
  preferredAEADAlgorithm: openpgp.enums.aead.ocb
};

const encrypted = await openpgp.encrypt({
  message,
  encryptionKeys: encryptionKey,
  format: 'armored',
  config: encryptionConfig
});

if (
  typeof encrypted !== 'string' ||
  !encrypted.startsWith('-----BEGIN PGP MESSAGE-----')
) {
  throw new Error('OpenPGP.js did not produce an armored encrypted message');
}

console.log(`OpenPGP.js ${tag} smoke test passed`);
