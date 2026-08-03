import { readFile } from 'node:fs/promises';

import * as openpgp from '../site/vendor/openpgp.min.mjs';

const publicKeyArmored = await readFile(
  new URL('../site/pubkey.asc', import.meta.url),
  'utf8'
);
const tag = (
  await readFile(new URL('../site/vendor/openpgp.tag.txt', import.meta.url), 'utf8')
).trim();

if (!tag) {
  throw new Error('site/vendor/openpgp.tag.txt is empty');
}

const encryptionKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
const message = await openpgp.createMessage({ text: 'webpgp-ui OpenPGP.js smoke test' });
const encrypted = await openpgp.encrypt({
  message,
  encryptionKeys: encryptionKey,
  format: 'armored'
});

if (
  typeof encrypted !== 'string' ||
  !encrypted.startsWith('-----BEGIN PGP MESSAGE-----')
) {
  throw new Error('OpenPGP.js did not produce an armored encrypted message');
}

console.log(`OpenPGP.js ${tag} smoke test passed`);
