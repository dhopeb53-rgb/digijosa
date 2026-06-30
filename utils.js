/**
 * General-purpose helpers shared by the survey app.
 */

// Logger function
function log(msg, type = 'info') {
  const consoleArea = document.getElementById('loggerConsole');
  if (!consoleArea) return;

  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('span');
  entry.className = `log-entry ${type}`;
  entry.innerText = `[${time}] ${msg}`;

  consoleArea.appendChild(entry);
  consoleArea.scrollTop = consoleArea.scrollHeight;
}

// Convert Base64 to ArrayBuffer (for ExcelJS loading)
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert File to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// Formatting helpers for Korean standard numbers
function formatJumin(val) {
  val = val.replace(/[^0-9]/g, '');
  if (val.length <= 6) return val;
  return val.slice(0, 6) + '-' + val.slice(6, 13);
}

function formatDate(val) {
  val = val.replace(/[^0-9]/g, '');
  if (val.length <= 4) return val;
  if (val.length <= 6) return val.slice(0, 4) + '-' + val.slice(4);
  return val.slice(0, 4) + '-' + val.slice(4, 6) + '-' + val.slice(6, 8);
}

function formatPhone(val) {
  val = val.replace(/[^0-9]/g, '');
  if (val.startsWith('02')) {
    if (val.length < 3) return val;
    if (val.length < 6) return val.substr(0, 2) + '-' + val.substr(2);
    if (val.length < 10) return val.substr(0, 2) + '-' + val.substr(2, 3) + '-' + val.substr(5);
    return val.substr(0, 2) + '-' + val.substr(2, 4) + '-' + val.substr(6, 4);
  } else {
    if (val.length < 4) return val;
    if (val.length < 7) return val.substr(0, 3) + '-' + val.substr(3);
    if (val.length < 11) return val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
    return val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7, 4);
  }
}

function formatBizNo(val) {
  val = val.replace(/[^0-9]/g, '');
  if (val.length <= 3) return val;
  if (val.length <= 5) return val.slice(0, 3) + '-' + val.slice(3);
  return val.slice(0, 3) + '-' + val.slice(3, 5) + '-' + val.slice(5, 10);
}

function formatCorpNo(val) {
  val = val.replace(/[^0-9]/g, '');
  if (val.length <= 6) return val;
  return val.slice(0, 6) + '-' + val.slice(6, 13);
}

function formatExcelAddress(primary, road, zip, detail, jibun) {
  let mainAddress = primary || '';
  if (detail) {
    mainAddress = mainAddress ? `${mainAddress} ${detail}` : detail;
  }
  if (zip) {
    mainAddress += `\n(우편번호: ${zip})`;
  }
  return mainAddress;
}

function compactAddressFromDong(address) {
  const value = (address || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';

  const dongMatch = value.match(/(?:^|\s)([^\s]+(?:동|읍|면|리)(?:\s+.*)?$)/);
  if (dongMatch) return dongMatch[1].trim();

  return value;
}

function addOutOfDistrictMarker(value, checked) {
  if (!checked || !value) return value;
  return value.startsWith('(지구외)') ? value : `(지구외) ${value}`;
}

function getOwnerDisplayName() {
  const owner = (db.survey.owner || '').trim();
  const sharedCount = db.survey.ownershipMode === 'shared' ? db.coOwners.length : 0;
  if (!owner) return sharedCount ? `공유자 ${sharedCount}명` : '';
  return sharedCount ? `${owner} 외 ${sharedCount}인` : owner;
}
