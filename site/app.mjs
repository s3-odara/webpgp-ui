import * as openpgp from './vendor/openpgp.min.mjs';

const elements = {
  fingerprint: document.getElementById('fingerprint'),
  openpgpVersion: document.getElementById('openpgp-version'),
  error: document.getElementById('error'),
  plaintext: document.getElementById('plaintext'),
  ciphertext: document.getElementById('ciphertext'),
  encrypt: document.getElementById('encrypt'),
  copy: document.getElementById('copy'),
  copyStatus: document.getElementById('copy-status'),
  fileInput: document.getElementById('file-input'),
  folderInput: document.getElementById('folder-input'),
  selectedFilesSummary: document.getElementById('selected-files-summary'),
  selectedFilesList: document.getElementById('selected-files-list'),
  clearFiles: document.getElementById('clear-files'),
  encryptFiles: document.getElementById('encrypt-files'),
  downloadName: document.getElementById('download-name'),
  downloadLink: document.getElementById('download-link'),
  encryptedFilesSummary: document.getElementById('encrypted-files-summary'),
  encryptedFilesList: document.getElementById('encrypted-files-list')
};

let publicKey = null;
let downloadUrl = null;
let fileEncryptionBusy = false;
const selectedFiles = [];
const encoder = new TextEncoder();

function setError(message) {
  if (!message) {
    elements.error.textContent = '';
    elements.error.classList.remove('show');
    return;
  }
  elements.error.textContent = message;
  elements.error.classList.add('show');
}

function setDownload(name, blob) {
  if (!blob) {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    elements.downloadName.textContent = '-';
    elements.downloadLink.setAttribute('aria-disabled', 'true');
    elements.downloadLink.removeAttribute('href');
    elements.downloadLink.removeAttribute('download');
    return;
  }

  const nextDownloadUrl = URL.createObjectURL(blob);
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
  }
  downloadUrl = nextDownloadUrl;
  elements.downloadName.textContent = name;
  elements.downloadLink.href = downloadUrl;
  elements.downloadLink.download = name;
  elements.downloadLink.setAttribute('aria-disabled', 'false');
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
    updateFileEncryptionControls();
  } catch (err) {
    publicKey = null;
    elements.encrypt.disabled = true;
    updateFileEncryptionControls();
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

function normalizeTarPath(path) {
  let normalized = path.replace(/\\\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  return normalized || 'file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  const digits = value < 10 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function updateFileEncryptionControls() {
  elements.fileInput.disabled = fileEncryptionBusy;
  elements.folderInput.disabled = fileEncryptionBusy;
  elements.clearFiles.disabled = fileEncryptionBusy || selectedFiles.length === 0;
  elements.encryptFiles.disabled = fileEncryptionBusy || !publicKey;
  for (const button of elements.selectedFilesList.querySelectorAll('.remove-file')) {
    button.disabled = fileEncryptionBusy;
  }
}

function setFileEncryptionBusy(busy) {
  fileEncryptionBusy = busy;
  updateFileEncryptionControls();
}

function renderSelectedFiles() {
  const totalSize = selectedFiles.reduce((total, item) => total + item.file.size, 0);
  elements.selectedFilesSummary.textContent = `${selectedFiles.length}件 / 合計 ${formatFileSize(totalSize)}`;

  const fragment = document.createDocumentFragment();
  if (selectedFiles.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'selected-files-empty';
    empty.textContent = 'ファイルは選択されていません。';
    fragment.append(empty);
  } else {
    const sortedFiles = [...selectedFiles].sort((a, b) => a.path.localeCompare(b.path));
    for (const item of sortedFiles) {
      const row = document.createElement('li');
      row.className = 'selected-file';

      const path = document.createElement('span');
      path.className = 'selected-file-path';
      path.textContent = item.path;

      const size = document.createElement('span');
      size.className = 'selected-file-size';
      size.textContent = formatFileSize(item.file.size);

      const remove = document.createElement('button');
      remove.className = 'remove-file';
      remove.type = 'button';
      remove.dataset.path = item.path;
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${item.path} を選択から削除`);
      remove.disabled = fileEncryptionBusy;

      row.append(path, size, remove);
      fragment.append(row);
    }
  }
  elements.selectedFilesList.replaceChildren(fragment);
  updateFileEncryptionControls();
}

function renderEncryptedFiles(files) {
  const totalSize = files.reduce((total, item) => total + item.size, 0);
  elements.encryptedFilesSummary.hidden = false;
  elements.encryptedFilesSummary.textContent = `${files.length}件 / 合計 ${formatFileSize(totalSize)}`;
  elements.encryptedFilesList.hidden = false;

  const fragment = document.createDocumentFragment();
  for (const item of files) {
    const row = document.createElement('li');
    row.className = 'selected-file';

    const path = document.createElement('span');
    path.className = 'selected-file-path';
    path.textContent = item.path;

    const size = document.createElement('span');
    size.className = 'selected-file-size';
    size.textContent = formatFileSize(item.size);

    row.append(path, size);
    fragment.append(row);
  }
  elements.encryptedFilesList.replaceChildren(fragment);
}

function removeSelectedFile(event) {
  const path = event.target?.closest?.('.remove-file')?.dataset.path;
  if (!path || fileEncryptionBusy) {
    return;
  }
  const index = selectedFiles.findIndex((item) => item.path === path);
  if (index < 0) {
    return;
  }
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

function addSelectedFiles(files, input) {
  if (fileEncryptionBusy) {
    input.value = '';
    return;
  }
  try {
    const existingPaths = new Set(selectedFiles.map((item) => item.path));
    const batch = [];
    for (const file of files) {
      const path = normalizeTarPath(file.webkitRelativePath || file.name);
      if (existingPaths.has(path)) {
        throw new Error(`ファイルパスが重複しています: ${path}`);
      }
      existingPaths.add(path);
      batch.push({ path, file });
    }
    if (batch.length > 0) {
      selectedFiles.push(...batch);
      renderSelectedFiles();
      setError('');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'ファイルの追加に失敗しました');
  } finally {
    input.value = '';
  }
}

function clearSelectedFiles() {
  if (fileEncryptionBusy) {
    return;
  }
  selectedFiles.length = 0;
  renderSelectedFiles();
}

function byteLength(value) {
  return encoder.encode(value).length;
}

function splitTarPath(path) {
  if (byteLength(path) <= 100) {
    return { name: path, prefix: '' };
  }
  for (let i = path.lastIndexOf('/'); i > 0; i = path.lastIndexOf('/', i - 1)) {
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (byteLength(name) <= 100 && byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }
  throw new Error(`ファイル名が長すぎます: ${path}`);
}

function writeString(view, offset, length, value) {
  const bytes = encoder.encode(value);
  if (bytes.length > length) {
    throw new Error(`文字列が長すぎます: ${value}`);
  }
  view.fill(0, offset, offset + length);
  view.set(bytes, offset);
}

function writeOctal(view, offset, length, value) {
  const octal = value.toString(8).padStart(length - 1, '0') + '\0';
  writeString(view, offset, length, octal);
}

function buildTarHeader(path, size, mtime) {
  const header = new Uint8Array(512);
  const { name, prefix } = splitTarPath(path);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtime);
  for (let i = 148; i < 156; i += 1) {
    header[i] = 0x20;
  }
  writeString(header, 156, 1, '0');
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  writeString(header, 265, 32, 'root');
  writeString(header, 297, 32, 'root');
  writeString(header, 345, 155, prefix);

  let checksum = 0;
  for (let i = 0; i < 512; i += 1) {
    checksum += header[i];
  }
  const checksumStr = checksum.toString(8).padStart(6, '0');
  writeString(header, 148, 6, checksumStr);
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

async function buildTar(files) {
  const parts = [];
  let total = 0;
  const zeroBlock = new Uint8Array(512);

  for (const { path, file } of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    const mtime = Math.floor((file.lastModified || Date.now()) / 1000);
    const header = buildTarHeader(path, data.length, mtime);
    parts.push(header, data);
    total += header.length + data.length;
    const padLength = (512 - (data.length % 512)) % 512;
    if (padLength) {
      const padding = new Uint8Array(padLength);
      parts.push(padding);
      total += padding.length;
    }
  }

  parts.push(zeroBlock, zeroBlock);
  total += zeroBlock.length * 2;

  const tar = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    tar.set(part, offset);
    offset += part.length;
  }
  return tar;
}

function collectFiles() {
  const byPath = new Map();
  for (const item of selectedFiles) {
    if (byPath.has(item.path)) {
      throw new Error(`ファイルパスが重複しています: ${item.path}`);
    }
    byPath.set(item.path, item);
  }
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}

async function encryptFiles() {
  if (!publicKey) {
    setError('公開鍵が読み込まれていません。');
    return;
  }
  setFileEncryptionBusy(true);
  try {
    const files = collectFiles();
    if (files.length === 0) {
      setError('暗号化するファイルまたはフォルダを選択してください。');
      return;
    }
    const tar = await buildTar(files);
    const message = await openpgp.createMessage({ binary: tar });
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: publicKey,
      format: 'binary'
    });
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const filename = `encrypted-${timestamp}.tar.gpg`;
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const encryptedFiles = files.map(({ path, file }) => ({ path, size: file.size }));
    setDownload(filename, blob);
    renderEncryptedFiles(encryptedFiles);
    selectedFiles.length = 0;
    renderSelectedFiles();
    setError('');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'ファイル暗号化に失敗しました');
  } finally {
    setFileEncryptionBusy(false);
  }
}

async function copyCiphertext() {
  const text = elements.ciphertext.value;
  if (!text) {
    return;
  }
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    elements.ciphertext.focus();
    elements.ciphertext.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
  }
  if (copied) {
    showCopyStatus();
  }
}

let copyStatusTimer = null;

function showCopyStatus() {
  if (!elements.copyStatus) {
    return;
  }
  elements.copyStatus.classList.add('show');
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer);
  }
  copyStatusTimer = setTimeout(() => {
    elements.copyStatus.classList.remove('show');
    copyStatusTimer = null;
  }, 1800);
}

function init() {
  elements.encrypt.addEventListener('click', encryptMessage);
  elements.encryptFiles.addEventListener('click', encryptFiles);
  elements.copy.addEventListener('click', copyCiphertext);
  elements.fileInput.addEventListener('change', () => {
    addSelectedFiles(elements.fileInput.files, elements.fileInput);
  });
  elements.folderInput.addEventListener('change', () => {
    addSelectedFiles(elements.folderInput.files, elements.folderInput);
  });
  elements.clearFiles.addEventListener('click', clearSelectedFiles);
  elements.selectedFilesList.addEventListener('click', removeSelectedFile);
  elements.encrypt.disabled = true;
  elements.encryptFiles.disabled = true;
  renderSelectedFiles();
  setDownload(null, null);
  loadVersion();
  loadPublicKey();
}

init();
