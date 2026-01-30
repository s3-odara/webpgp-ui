import * as openpgp from './vendor/openpgp.min.mjs';

const elements = {
  fingerprint: document.getElementById('fingerprint'),
  openpgpVersion: document.getElementById('openpgp-version'),
  error: document.getElementById('error'),
  plaintext: document.getElementById('plaintext'),
  ciphertext: document.getElementById('ciphertext'),
  encrypt: document.getElementById('encrypt'),
  copy: document.getElementById('copy')
};

let publicKey = null;

function setError(message) {
  if (!message) {
    elements.error.textContent = '';
    elements.error.classList.remove('show');
    return;
  }
  elements.error.textContent = message;
  elements.error.classList.add('show');
}

async function loadVersion() {
  try {
    const res = await fetch('/vendor/openpgp.version.txt', { cache: 'no-store' });
    if (!res.ok) {
      return;
    }
    const version = (await res.text()).trim();
    if (version) {
      elements.openpgpVersion.textContent = version;
    }
  } catch {
    // optional display only
  }
}

async function loadPublicKey() {
  try {
    const res = await fetch('/pubkey.asc', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`公開鍵の取得に失敗しました (${res.status})`);
    }
    const armoredKey = await res.text();
    publicKey = await openpgp.readKey({ armoredKey });
    elements.fingerprint.textContent = publicKey.getFingerprint();
    setError('');
    elements.encrypt.disabled = false;
  } catch (err) {
    publicKey = null;
    elements.encrypt.disabled = true;
    elements.fingerprint.textContent = '未取得';
    setError(err instanceof Error ? err.message : '公開鍵の取得に失敗しました');
  }
}

async function encryptMessage() {
  if (!publicKey) {
    setError('公開鍵が読み込まれていません。');
    return;
  }
  const plaintext = elements.plaintext.value;
  try {
    const message = await openpgp.createMessage({ text: plaintext });
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: publicKey,
      format: 'armored'
    });
    elements.ciphertext.value = encrypted;
    setError('');
  } catch (err) {
    setError(err instanceof Error ? err.message : '暗号化に失敗しました');
  }
}

async function copyCiphertext() {
  const text = elements.ciphertext.value;
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    elements.ciphertext.focus();
    elements.ciphertext.select();
  }
}

function init() {
  elements.encrypt.addEventListener('click', encryptMessage);
  elements.copy.addEventListener('click', copyCiphertext);
  elements.encrypt.disabled = true;
  loadVersion();
  loadPublicKey();
}

init();
