/**
 * SheetCraft AI - Construction Survey & Photo Log Automation Tool
 * Core JavaScript Logic
 */

// Global State
let db = {
  survey: {
    date: '',
    surveyor: '',
    witness: '',
    owner: '',
    location: '',
    company: '',
    bizType: '',
    bizStatus: '',
    repName: '',
    repJumin: '',
    repAddr: '',
    repContact: '',
    bizRegNo: '',
    corpRegNo: '',
    notes: '',
    photo: '', // Base64 of Site Panorama / Floor Plan
    district: '', // Project District Name (Bottom Left Overlay)
    bizLocation: '', // Address on Business Registration
    locationRoad: '',
    locationJibun: '',
    locationZip: '',
    locationDetail: '',
    repRoad: '',
    repJibun: '',
    repZip: '',
    repDetail: '',
    bizLocationRoad: '',
    bizLocationJibun: '',
    bizLocationZip: '',
    bizLocationDetail: '',
    outOfDistrict: false, // Out of District Status
    repOutOfDistrict: false,
    bizOutOfDistrict: false,
    hasLedger: false,
    isBusiness: false,
    isResidence: false,
    hasElectricity: false,
    hasWater: false,
    hasSeptic: false,
    rentType: '자가',
    permitNotes: '',
    surveyorSignature: '',
    witnessSignature: '',
    ownershipMode: 'single'
  },
  coOwners: [],
  items: [], // List of items/objects (Tab 2)
  documents: [] // Additional submitted photos
};

// Default template row config in Excel Template (Sheet 2: 물건내역(영업))
const EXCEL_ITEM_START_ROW = 3;
const EXCEL_DEFAULT_ITEMS_COUNT = 4; // B3:B6 exist by default

// Dropdown lists extracted from the Excel template validations (Data Validations)
const SURVEY_ITEM_TYPES = [
  "가옥", "공장", "상가", "기타건물", "주거용비닐하우스", "농업용비닐하우스", 
  "기타비닐하우스", "한전주", "통신주", "기타전주", "기타지장물", "농기구", 
  "수목", "가추", "차양"
];

const SURVEY_ITEM_UNITS = [
  "㎡", "주", "식", "대", "개", "m", "기타", "기", "두", "동", "t", 
  "조", "Kg", "세트", "톤", "상자", "차", "마리", "㎥", "군", "본", "정",
  "장", "수", "개소", "점", "매", "포", "평", "바렛", "파레트", "마대", 
  "소", "각", "cm", "단", "폭", "근", "판", "척", "간", "가마", "해당없음"
];

// Tab switching
const tabs = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    const paneId = tab.getAttribute('data-tab');
    document.getElementById(paneId).classList.add('active');
    
    log(`탭 전환: ${tab.innerText.trim()}`);
  });
});

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

const ADDRESS_CONFIG = {
  location: {
    inputId: 'location_name',
    postcodeId: 'location_postcode',
    detailId: 'location_detail',
    mainKey: 'location',
    roadKey: 'locationRoad',
    jibunKey: 'locationJibun',
    zipKey: 'locationZip',
    detailKey: 'locationDetail'
  },
  rep: {
    inputId: 'rep_addr',
    postcodeId: 'rep_postcode',
    detailId: 'rep_detail',
    mainKey: 'repAddr',
    roadKey: 'repRoad',
    jibunKey: 'repJibun',
    zipKey: 'repZip',
    detailKey: 'repDetail'
  },
  biz: {
    inputId: 'biz_location',
    postcodeId: 'biz_postcode',
    detailId: 'biz_detail',
    mainKey: 'bizLocation',
    roadKey: 'bizLocationRoad',
    jibunKey: 'bizLocationJibun',
    zipKey: 'bizLocationZip',
    detailKey: 'bizLocationDetail'
  }
};

function updateAddressMeta(config) {
  const postcodeInput = document.getElementById(config.postcodeId);
  if (postcodeInput) postcodeInput.value = db.survey[config.zipKey] || '';
}

function syncAddressFieldsFromForm() {
  Object.values(ADDRESS_CONFIG).forEach(config => {
    const input = document.getElementById(config.inputId);
    const detailInput = document.getElementById(config.detailId);
    const zipInput = document.getElementById(config.postcodeId);
    if (input) db.survey[config.mainKey] = input.value.trim();
    if (detailInput) db.survey[config.detailKey] = detailInput.value.trim();
    if (zipInput) db.survey[config.zipKey] = zipInput.value.trim();
  });
}

function closeAddressSearch() {
  const modal = document.getElementById('addressModal');
  const container = document.getElementById('addressPostcodeContainer');
  modal.classList.add('hidden');
  container.innerHTML = '';
}

const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let postcodeScriptPromise = null;

function getPostcodeConstructor() {
  return (window.daum && window.daum.Postcode)
    || (window.kakao && window.kakao.Postcode)
    || null;
}

function loadPostcodeScript() {
  const existingPostcode = getPostcodeConstructor();
  if (existingPostcode) return Promise.resolve(existingPostcode);
  if (postcodeScriptPromise) return postcodeScriptPromise;

  postcodeScriptPromise = new Promise((resolve, reject) => {
    const existingScripts = Array.from(document.scripts).filter(script =>
      script.src && script.src.includes('/postcode/prod/postcode.v2.js')
    );
    existingScripts.forEach(script => script.remove());

    const finish = () => {
      const Postcode = getPostcodeConstructor();
      if (Postcode) {
        resolve(Postcode);
      } else {
        postcodeScriptPromise = null;
        reject(new Error('Daum Postcode API was not registered.'));
      }
    };

    const script = document.createElement('script');
    script.src = `${POSTCODE_SCRIPT_URL}?v=${Date.now()}`;
    script.async = true;
    script.onload = finish;
    script.onerror = () => {
      postcodeScriptPromise = null;
      reject(new Error('Daum Postcode script failed to load.'));
    };
    document.head.appendChild(script);
  });

  return postcodeScriptPromise;
}

async function openAddressSearch(target) {
  const config = ADDRESS_CONFIG[target];
  if (!config) return;

  let Postcode = getPostcodeConstructor();

  if (!Postcode) {
    try {
      Postcode = await loadPostcodeScript();
    } catch (err) {
      console.error('주소 검색 서비스 로딩 실패:', err);
      alert('주소 검색 서비스를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
      return;
    }
  }

  if (!Postcode) {
    alert('주소 검색 서비스를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    return;
  }

  const modal = document.getElementById('addressModal');
  const container = document.getElementById('addressPostcodeContainer');
  container.innerHTML = '';
  modal.classList.remove('hidden');

  new Postcode({
    oncomplete(data) {
      try {
        const primary = data.jibunAddress
          || data.autoJibunAddress
          || data.address
          || data.roadAddress
          || data.autoRoadAddress
          || '';
        const input = document.getElementById(config.inputId);
        const detailInput = document.getElementById(config.detailId);

        db.survey[config.roadKey] = data.roadAddress || data.autoRoadAddress || '';
        db.survey[config.jibunKey] = data.jibunAddress || data.autoJibunAddress || '';
        db.survey[config.zipKey] = data.zonecode || '';

        if (input) {
          input.value = primary;
          try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (eventError) {
            console.error('주소 입력 이벤트 처리 실패:', eventError);
          }
        }
        updateAddressMeta(config);
        closeAddressSearch();
        if (detailInput) {
          detailInput.focus();
        }
        log(`${input && input.previousElementSibling ? input.previousElementSibling.textContent : '주소'} 검색 완료.`);
      } catch (err) {
        console.error('주소 선택 완료 처리 중 오류 발생:', err);
        alert('주소 입력 중 오류가 발생했습니다: ' + err.message);
        closeAddressSearch();
      }
    },
    width: '100%',
    height: '100%'
  }).embed(container);
}

// Generate default description from item fields (name, qty, unit, specs)
function getDefaultItemDesc(item) {
  let desc = item.name || '';
  if (item.qty) {
    desc += ` ${item.qty}`;
    if (item.unit) {
      desc += item.unit;
    }
  }
  if (item.specs) {
    desc += ` (${item.specs})`;
  }
  return desc.trim();
}

function getCompositeItemDesc(item) {
  let name = item.customName !== undefined ? item.customName : (item.name || '');
  let qty = item.customQty !== undefined ? item.customQty : (item.qty || '');
  let unit = item.customUnit !== undefined ? item.customUnit : (item.unit || '');
  let specs = item.customSpecs !== undefined ? item.customSpecs : (item.specs || '');
  
  let desc = name;
  if (qty) {
    desc += ` ${qty}`;
    if (unit) {
      desc += unit;
    }
  }
  if (specs) {
    desc += ` (${specs})`;
  }
  return desc.trim();
}

let signatureState = {
  target: null,
  isDrawing: false,
  hasStroke: false
};

function initSignaturePad() {
  const modal = document.getElementById('signatureModal');
  const canvas = document.getElementById('signatureCanvas');
  const title = document.getElementById('signatureModalTitle');
  const btnClose = document.getElementById('btnCloseSignature');
  const btnClear = document.getElementById('btnSignatureClear');
  const btnSave = document.getElementById('btnSignatureSave');
  if (!modal || !canvas || !title || !btnClose || !btnClear || !btnSave) return;

  const ctx = canvas.getContext('2d');

  const clearCanvas = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    signatureState.hasStroke = false;
  };

  const getCoords = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawStart = (event) => {
    event.preventDefault();
    signatureState.isDrawing = true;
    signatureState.hasStroke = true;
    const { x, y } = getCoords(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawMove = (event) => {
    if (!signatureState.isDrawing) return;
    event.preventDefault();
    const { x, y } = getCoords(event);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const drawEnd = (event) => {
    if (event) event.preventDefault();
    signatureState.isDrawing = false;
  };

  const openSignatureModal = (target) => {
    signatureState.target = target;
    clearCanvas();
    title.textContent = target === 'surveyor' ? '조사자 서명' : '입회자 서명';

    const saved = target === 'surveyor'
      ? db.survey.surveyorSignature
      : db.survey.witnessSignature;

    if (saved) {
      const img = new Image();
      img.onload = () => {
        clearCanvas();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        signatureState.hasStroke = true;
      };
      img.src = `data:image/jpeg;base64,${saved}`;
    }

    modal.classList.remove('hidden');
  };

  const closeSignatureModal = () => {
    signatureState.target = null;
    signatureState.isDrawing = false;
    modal.classList.add('hidden');
  };

  const updateSignatureButton = (target) => {
    const button = document.querySelector(`.btn-signature-open[data-signature-target="${target}"]`);
    if (!button) return;
    const signed = target === 'surveyor'
      ? !!db.survey.surveyorSignature
      : !!db.survey.witnessSignature;
    button.classList.toggle('is-signed', signed);
    button.textContent = signed ? '서명완료' : '서명';
  };

  document.querySelectorAll('.btn-signature-open').forEach(button => {
    button.addEventListener('click', () => openSignatureModal(button.dataset.signatureTarget));
  });

  btnClose.addEventListener('click', closeSignatureModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeSignatureModal();
  });

  btnClear.addEventListener('click', clearCanvas);

  btnSave.addEventListener('click', () => {
    if (!signatureState.target) return;
    const signatureBase64 = signatureState.hasStroke
      ? canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
      : '';

    if (signatureState.target === 'surveyor') {
      db.survey.surveyorSignature = signatureBase64;
    } else {
      db.survey.witnessSignature = signatureBase64;
    }

    updateSignatureButton(signatureState.target);
    log(`${signatureState.target === 'surveyor' ? '조사자' : '입회자'} 서명 저장 완료.`);
    closeSignatureModal();
  });

  canvas.addEventListener('mousedown', drawStart);
  canvas.addEventListener('mousemove', drawMove);
  canvas.addEventListener('mouseup', drawEnd);
  canvas.addEventListener('mouseleave', drawEnd);
  canvas.addEventListener('touchstart', drawStart, { passive: false });
  canvas.addEventListener('touchmove', drawMove, { passive: false });
  canvas.addEventListener('touchend', drawEnd, { passive: false });

  clearCanvas();
}

function updateCoOwnerSummary() {
  const summary = document.getElementById('coOwnerSummary');
  const modeSelect = document.getElementById('ownership_mode');
  if (summary) summary.textContent = `공유자 ${db.coOwners.length}명`;
  if (modeSelect) modeSelect.value = db.survey.ownershipMode || 'single';
  syncSurveyHeadersToPhotos();
}

function addCoOwner(data = {}) {
  db.coOwners.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: data.name || '',
    jumin: data.jumin || '',
    contact: data.contact || '',
    share: data.share || '',
    memo: data.memo || ''
  });
  renderCoOwners();
}

function removeCoOwner(id) {
  db.coOwners = db.coOwners.filter(owner => owner.id !== id);
  renderCoOwners();
}

function renderCoOwners() {
  const section = document.getElementById('coOwnerSection');
  const list = document.getElementById('coOwnerList');
  if (!section || !list) return;

  section.classList.toggle('hidden', db.survey.ownershipMode !== 'shared');
  list.innerHTML = '';

  if (db.survey.ownershipMode === 'shared' && db.coOwners.length === 0) {
    list.innerHTML = `<div class="co-owner-empty">공유자를 추가하면 지분 정보를 함께 정리할 수 있습니다.</div>`;
  }

  db.coOwners.forEach((owner, index) => {
    const card = document.createElement('div');
    card.className = 'co-owner-card';
    card.dataset.ownerId = owner.id;
    card.innerHTML = `
      <input type="text" class="co-owner-name" placeholder="공유자 #${index + 1} 성명" value="${owner.name}">
      <input type="text" class="co-owner-jumin" placeholder="주민등록번호" value="${owner.jumin}">
      <input type="text" class="co-owner-contact" placeholder="전화번호" value="${owner.contact}">
      <input type="text" class="co-owner-share" placeholder="지분" value="${owner.share}">
      <input type="text" class="co-owner-memo" placeholder="비고" value="${owner.memo}">
      <button type="button" class="btn-remove-co-owner">삭제</button>
    `;
    list.appendChild(card);

    card.querySelector('.co-owner-name').addEventListener('input', (e) => {
      owner.name = e.target.value;
      updateCoOwnerSummary();
    });
    card.querySelector('.co-owner-jumin').addEventListener('input', (e) => {
      const val = formatJumin(e.target.value);
      e.target.value = val;
      owner.jumin = val;
    });
    card.querySelector('.co-owner-contact').addEventListener('input', (e) => {
      const val = formatPhone(e.target.value);
      e.target.value = val;
      owner.contact = val;
    });
    card.querySelector('.co-owner-share').addEventListener('input', (e) => {
      owner.share = e.target.value;
    });
    card.querySelector('.co-owner-memo').addEventListener('input', (e) => {
      owner.memo = e.target.value;
    });
    card.querySelector('.btn-remove-co-owner').addEventListener('click', () => removeCoOwner(owner.id));
  });

  updateCoOwnerSummary();
}

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  log('디지털 기본조사서 초기화 중...');
  lucide.createIcons();
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('surveyor_date').value = today;
  db.survey.date = today;
  
  // Load template base64
  try {
    if (typeof TEMPLATE_BASE64 !== 'undefined') {
      const statusBadge = document.getElementById('templateStatus');
      statusBadge.classList.add('ready');
      statusBadge.querySelector('.status-text').innerText = '템플릿 준비 완료';
      log('엑셀 양식 템플릿(Base64) 로드 완료.');
    } else {
      throw new Error('TEMPLATE_BASE64 변수를 찾을 수 없습니다.');
    }
  } catch (err) {
    log(`템플릿 로드 실패: ${err.message}`, 'error');
    alert('템플릿 로드에 실패했습니다. template_data.js 파일이 올바르게 생성되었는지 확인해 주세요.');
  }

  // Bind Survey Form Inputs to DB
  const surveyInputs = [
    { id: 'surveyor_date', key: 'date' },
    { id: 'surveyor_name', key: 'surveyor' },
    { id: 'witness_name', key: 'witness' },
    { id: 'owner_name', key: 'owner' },
    { id: 'location_name', key: 'location' },
    { id: 'company_name', key: 'company' },
    { id: 'biz_type', key: 'bizType' },
    { id: 'biz_status', key: 'bizStatus' },
    { id: 'rep_name', key: 'repName' },
    { id: 'rep_jumin', key: 'repJumin' },
    { id: 'rep_addr', key: 'repAddr' },
    { id: 'rep_contact', key: 'repContact' },
    { id: 'biz_reg_no', key: 'bizRegNo' },
    { id: 'corp_reg_no', key: 'corpRegNo' },
    { id: 'special_notes', key: 'notes' },
    { id: 'district_name', key: 'district' },
    { id: 'biz_location', key: 'bizLocation' },
    { id: 'rent_type', key: 'rentType' },
    { id: 'permit_notes', key: 'permitNotes' }
  ];

  surveyInputs.forEach(inputInfo => {
    const el = document.getElementById(inputInfo.id);
    if (el) {
      el.addEventListener('input', (e) => {
        let val = e.target.value;
        const oldVal = db.survey[inputInfo.key];
        
        // Apply auto-formatting as the user types
        if (inputInfo.key === 'repJumin') {
          val = formatJumin(val);
          e.target.value = val;
        } else if (inputInfo.key === 'repContact') {
          val = formatPhone(val);
          e.target.value = val;
        } else if (inputInfo.key === 'bizRegNo') {
          val = formatBizNo(val);
          e.target.value = val;
        } else if (inputInfo.key === 'corpRegNo') {
          val = formatCorpNo(val);
          e.target.value = val;
        } else if (inputInfo.key === 'date') {
          val = formatDate(val);
          e.target.value = val;
        }
        
        db.survey[inputInfo.key] = val;
        
        // Sync owner/location/district immediately to headers if photo tab is active
        if (inputInfo.key === 'owner' || inputInfo.key === 'location' || inputInfo.key === 'district') {
          if (inputInfo.key === 'location') {
            // Update item locations in Tab 2 if they match the old global location or are empty
            const oldCompactVal = compactAddressFromDong(oldVal);
            const nextCompactVal = compactAddressFromDong(val);
            db.items.forEach(item => {
              if (!item.location || item.location === oldVal || item.location === oldCompactVal) {
                item.location = nextCompactVal;
                // Update the DOM input in Tab 2
                const cardEl = document.getElementById(`item-card-${item.id}`);
                if (cardEl) {
                  const locInput = cardEl.querySelector('.cell-location');
                  if (locInput) {
                    locInput.value = nextCompactVal;
                  }
                }
              }
            });
          }
          syncSurveyHeadersToPhotos();
        }
      });
    }
  });

  document.querySelectorAll('.btn-address-search').forEach(button => {
    button.addEventListener('click', () => openAddressSearch(button.dataset.addressTarget));
  });

  const ownershipModeEl = document.getElementById('ownership_mode');
  if (ownershipModeEl) {
    ownershipModeEl.addEventListener('change', (e) => {
      db.survey.ownershipMode = e.target.value;
      renderCoOwners();
    });
  }

  const btnAddCoOwner = document.getElementById('btnAddCoOwner');
  if (btnAddCoOwner) {
    btnAddCoOwner.addEventListener('click', () => {
      db.survey.ownershipMode = 'shared';
      if (ownershipModeEl) ownershipModeEl.value = 'shared';
      addCoOwner();
    });
  }
  renderCoOwners();

  document.getElementById('btnCloseAddress').addEventListener('click', closeAddressSearch);
  document.getElementById('addressModal').addEventListener('click', (e) => {
    if (e.target.id === 'addressModal') closeAddressSearch();
  });

  Object.values(ADDRESS_CONFIG).forEach(config => {
    const detailInput = document.getElementById(config.detailId);
    if (detailInput) {
      detailInput.addEventListener('input', (e) => {
        db.survey[config.detailKey] = e.target.value;
      });
    }
  });

  // Bind optional out-of-district checkbox if present
  const outOfDistrictEl = document.getElementById('out_of_district');
  if (outOfDistrictEl) {
    outOfDistrictEl.addEventListener('change', (e) => {
      db.survey.outOfDistrict = e.target.checked;
    });
  }

  document.querySelectorAll('.address-district-check').forEach(check => {
    check.addEventListener('change', (e) => {
      const targetType = e.target.dataset.addressCheck; // 'rep' or 'biz'
      if (targetType === 'rep') {
        db.survey.repOutOfDistrict = e.target.checked;
      } else if (targetType === 'biz') {
        db.survey.bizOutOfDistrict = e.target.checked;
      }
    });
  });

  // Bind new global checkboxes
  const hasLedgerEl = document.getElementById('has_ledger');
  if (hasLedgerEl) {
    hasLedgerEl.addEventListener('change', (e) => {
      db.survey.hasLedger = e.target.checked;
    });
  }

  const isBusinessEl = document.getElementById('is_business');
  if (isBusinessEl) {
    isBusinessEl.addEventListener('change', (e) => {
      db.survey.isBusiness = e.target.checked;
    });
  }

  const isResidenceEl = document.getElementById('is_residence');
  if (isResidenceEl) {
    isResidenceEl.addEventListener('change', (e) => {
      db.survey.isResidence = e.target.checked;
    });
  }

  [
    { id: 'has_electricity', key: 'hasElectricity' },
    { id: 'has_water', key: 'hasWater' },
    { id: 'has_septic', key: 'hasSeptic' }
  ].forEach(info => {
    const el = document.getElementById(info.id);
    if (el) {
      el.addEventListener('change', (e) => {
        db.survey[info.key] = e.target.checked;
      });
    }
  });

  // Handle Site Panorama / Floor Plan Photo Upload
  const surveyPhotoInput = document.getElementById('survey_photo');
  const surveyPhotoBox = document.getElementById('surveyPhotoBox');
  const surveyPhotoPreview = document.getElementById('surveyPhotoPreview');
  const btnRemoveSurveyPhoto = document.getElementById('btnRemoveSurveyPhoto');
  const uploadPlaceholder = surveyPhotoBox.querySelector('.upload-placeholder');
  const previewContainer = surveyPhotoBox.querySelector('.preview-container');

  surveyPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    log(`평면도 사진 업로드 중: ${file.name}`);
    try {
      const b64 = await fileToBase64(file);
      db.survey.photo = b64;
      
      surveyPhotoPreview.src = `data:${file.type};base64,${b64}`;
      uploadPlaceholder.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      log('평면도 사진 업로드 완료.');
    } catch (err) {
      log('사진 변환 실패', 'error');
    }
  });

  btnRemoveSurveyPhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    db.survey.photo = '';
    surveyPhotoInput.value = '';
    uploadPlaceholder.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    surveyPhotoPreview.src = '';
    log('평면도 사진이 제거되었습니다.');
  });

  // Tab 2: Add initial row
  addTableDataRow();
  addDocumentCard();
  
  // Bind Action Buttons
  document.getElementById('tableAddTrigger').addEventListener('click', () => {
    addTableDataRow(null, null, { focusName: true });
  });
  document.getElementById('documentAddTrigger').addEventListener('click', addDocumentCard);
  document.getElementById('btnDownloadZip').addEventListener('click', downloadZipArchive);
  document.getElementById('btnSendEmail').addEventListener('click', sendEmailWithZip);
  initSignaturePad();

  const surveyPhotoCard = document.getElementById('surveyPhotoCard');
  const btnToggleSurveyPhotoCard = document.getElementById('btnToggleSurveyPhotoCard');
  if (surveyPhotoCard && btnToggleSurveyPhotoCard) {
    btnToggleSurveyPhotoCard.addEventListener('click', () => {
      surveyPhotoCard.classList.toggle('collapsed');
      btnToggleSurveyPhotoCard.innerText = surveyPhotoCard.classList.contains('collapsed') ? '펼치기' : '접기';
    });
  }

  const businessInfoCard = document.getElementById('businessInfoCard');
  const btnToggleBusinessInfo = document.getElementById('btnToggleBusinessInfo');
  if (businessInfoCard && btnToggleBusinessInfo) {
    btnToggleBusinessInfo.addEventListener('click', () => {
      businessInfoCard.classList.toggle('collapsed');
      btnToggleBusinessInfo.innerText = businessInfoCard.classList.contains('collapsed') ? '펼치기' : '접기';
    });
  }
  
  // Collapsible Bottom Panel (Bottom Sheet) Logic
  const actionsPanel = document.getElementById('actionsPanel');
  const panelHeader = document.getElementById('panelHeader');
  
  panelHeader.addEventListener('click', () => {
    actionsPanel.classList.toggle('expanded');
    const isExpanded = actionsPanel.classList.contains('expanded');
    log(`내보내기 패널 ${isExpanded ? '열림' : '닫힘'}`);
  });

});

function getImageExtension(mimeType, originalName = '') {
  const originalExtension = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
  if (/^[a-z0-9]{2,5}$/.test(originalExtension)) return originalExtension === 'jpeg' ? 'jpg' : originalExtension;
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif'
  };
  return mimeMap[mimeType] || 'jpg';
}

function sanitizeFilename(name, fallback) {
  const clean = (name || fallback).trim().replace(/[\/\\?%*:|"<>]/g, '_').replace(/\.+$/g, '');
  return clean || fallback;
}

function setItemPhotoPreview(item) {
  const wrapper = document.querySelector(`#item-card-${item.id} .item-photo-preview-wrapper`);
  if (!wrapper) return;

  const activePhoto = item.compositeImage || item.image;
  if (activePhoto) {
    wrapper.innerHTML = `<img src="data:image/jpeg;base64,${activePhoto}" alt="물건 사진 미리보기">`;
  } else {
    wrapper.innerHTML = `<div class="no-photo-placeholder"><i data-lucide="camera"></i><span>물건 사진</span></div>`;
    lucide.createIcons();
  }
}

function calculateQuantityFromSpecs(item, card) {
  const specsEl = card.querySelector('.cell-specs');
  const qtyEl = card.querySelector('.cell-qty');
  const unitSelect = card.querySelector('.cell-unit');
  const unitCustom = card.querySelector('.cell-unit-custom');
  const raw = (specsEl.value || '').trim();
  const expression = raw.match(/(\d+(?:\.\d+)?)\s*(?:x|X|×|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|X|×|\*)\s*(\d+(?:\.\d+)?))?/);

  if (!expression) {
    alert('구조 및 규격에 예: 2.5x3 또는 2.5x3x2 형식으로 입력하면 수량을 계산할 수 있습니다.');
    return;
  }

  const numbers = expression.slice(1).filter(Boolean).map(Number);
  const result = numbers.reduce((acc, num) => acc * num, 1);
  const rounded = Math.round(result * 1000) / 1000;
  const nextUnit = numbers.length >= 3 ? '㎥' : '㎡';

  qtyEl.value = String(rounded);
  item.qty = qtyEl.value;

  if (SURVEY_ITEM_UNITS.includes(nextUnit)) {
    unitSelect.value = nextUnit;
    unitCustom.classList.add('hidden');
    item.unit = nextUnit;
  }

  syncItemData(item.id);
  log(`수량 자동 계산: ${numbers.join(' × ')} = ${rounded}${nextUnit}`);
}

function updateDocumentBadge() {
  const count = db.documents.filter(documentItem => documentItem.image).length;
  document.getElementById('documentBadge').innerText = count;
}

function addDocumentCard() {
  const documentItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    filename: `추가제출서류_${db.documents.length + 1}`,
    originalName: '',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    image: ''
  };
  db.documents.push(documentItem);
  renderDocumentCards();
}

function deleteDocumentCard(id) {
  db.documents = db.documents.filter(documentItem => documentItem.id !== id);
  renderDocumentCards();
}

function renderDocumentCards() {
  const grid = document.getElementById('documentCardsGrid');
  grid.innerHTML = '';

  if (db.documents.length === 0) {
    grid.innerHTML = `
      <div class="alert-info-box">
        <i data-lucide="image-plus"></i>
        <p>아래의 <strong>추가 제출서류 사진 추가</strong>를 눌러 사진을 등록하세요.</p>
      </div>
    `;
    updateDocumentBadge();
    lucide.createIcons();
    return;
  }

  db.documents.forEach((documentItem, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card document-card';
    card.dataset.documentId = documentItem.id;
    card.innerHTML = `
      <div class="photo-card-info-header">
        <span class="photo-card-num">추가서류 #${index + 1}</span>
        <span class="photo-card-title">${documentItem.filename}.${documentItem.extension}</span>
      </div>
      <div class="photo-card-body">
        <div class="photo-card-photo-col">
          <div class="document-preview-wrapper">
            ${documentItem.image
              ? `<img src="data:${documentItem.mimeType};base64,${documentItem.image}" alt="추가 제출서류 미리보기">`
              : `<div class="no-photo-placeholder"><i data-lucide="image"></i><span>사진 미리보기</span></div>`}
          </div>
          <input type="file" class="card-file-input document-file-input" accept="image/*">
        </div>
        <div class="photo-card-settings-col">
          <div class="form-group">
            <label>저장할 파일명</label>
            <input type="text" class="document-filename" value="${documentItem.filename}" placeholder="파일명 입력">
          </div>
          <p class="document-file-note">확장자는 선택한 사진 형식에 맞춰 자동 적용됩니다.</p>
          <div class="document-card-actions">
            <button type="button" class="btn-text-danger delete-document">삭제</button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);

    const fileInput = card.querySelector('.document-file-input');
    const filenameInput = card.querySelector('.document-filename');
    const title = card.querySelector('.photo-card-title');

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        documentItem.image = await fileToBase64(file);
        documentItem.originalName = file.name;
        documentItem.mimeType = file.type || 'image/jpeg';
        documentItem.extension = getImageExtension(documentItem.mimeType, file.name);
        if (!filenameInput.value.trim() || /^추가제출서류_\d+$/.test(filenameInput.value.trim())) {
          documentItem.filename = file.name.replace(/\.[^.]+$/, '');
        }
        renderDocumentCards();
        log(`추가 제출서류 사진 등록: ${file.name}`);
      } catch (err) {
        log('추가 제출서류 이미지 변환 실패', 'error');
      }
    });

    filenameInput.addEventListener('input', (e) => {
      documentItem.filename = e.target.value;
      title.textContent = `${e.target.value || `추가제출서류_${index + 1}`}.${documentItem.extension}`;
    });

    card.querySelector('.delete-document').addEventListener('click', () => deleteDocumentCard(documentItem.id));
  });

  updateDocumentBadge();
  lucide.createIcons();
}

// Dynamic Row addition (Item Form Card) (Tab 2)
let rowIdCounter = 0;
function addTableDataRow(sourceItem = null, insertAfterId = null, options = {}) {
  rowIdCounter++;
  const container = document.getElementById('itemCardsList');
  const card = document.createElement('div');
  card.id = `item-card-${rowIdCounter}`;
  card.className = 'item-form-card item-row-fade-in';
  
  const currentId = rowIdCounter;
  
  // Bind inputs within the card
  const defaults = {
    id: currentId,
    type: '기타지장물',
    name: '',
    specs: '',
    qty: 1,
    unit: '식',
    remarks: '',
    location: compactAddressFromDong(db.survey.location),
    hasLedger: false,
    isBusiness: false,
    isResidence: false,
    image: '', // Original upload Base64
    compositeImage: '', // Synthesized with board Base64
    overlayEnabled: true // Overlay enabled by default
  };
  const rowObj = sourceItem
    ? { ...sourceItem, id: currentId }
    : defaults;
  
  const insertIndex = insertAfterId === null
    ? db.items.length
    : db.items.findIndex(item => item.id === insertAfterId) + 1;
  db.items.splice(insertIndex, 0, rowObj);
  const itemIndex = insertIndex + 1;

  if (!SURVEY_ITEM_TYPES.includes(rowObj.type)) {
    rowObj.type = '기타지장물';
  }
  const isCustomType = false;
  const isCustomUnit = !SURVEY_ITEM_UNITS.includes(rowObj.unit);
  
  const typeOptionsHtml = SURVEY_ITEM_TYPES.map(t => 
    `<option value="${t}" ${!isCustomType && t === rowObj.type ? 'selected' : ''}>${t}</option>`
  ).join('');
  
  const unitOptionsHtml = SURVEY_ITEM_UNITS.map(u => 
    `<option value="${u}" ${!isCustomUnit && u === rowObj.unit ? 'selected' : ''}>${u}</option>`
  ).join('') + `<option value="custom" ${isCustomUnit ? 'selected' : ''}>직접 입력...</option>`;
  
  card.innerHTML = `
    <div class="item-card-header">
      <div class="item-card-title-line">
        <span class="item-num">물건 #${itemIndex}</span>
        <select class="cell-type item-header-type">
          ${typeOptionsHtml}
        </select>
        <div class="inline-location-field item-header-location">
          <span>물건소재지</span>
          <input type="text" class="cell-location" placeholder="예: OO동 OOO-OOO">
        </div>
        <div class="item-status-row item-header-status">
          <label class="checkbox-label-container">
            <input type="checkbox" class="cell-ledger">
            <span class="checkbox-text">건축물대장</span>
          </label>
          <label class="checkbox-label-container">
            <input type="checkbox" class="cell-business">
            <span class="checkbox-text">영업장</span>
          </label>
          <label class="checkbox-label-container">
            <input type="checkbox" class="cell-residence">
            <span class="checkbox-text">거주</span>
          </label>
        </div>
      </div>
      <div class="item-card-actions">
        <button type="button" class="btn-item-action btn-toggle-remarks" title="비고 입력 열기">+ 비고</button>
        <button type="button" class="btn-item-action btn-calc-qty" title="규격에서 수량 계산">계산</button>
        <button type="button" class="btn-item-action btn-duplicate-item" title="이 물건 복제">복제</button>
        <button type="button" class="btn-item-action btn-move-up" title="위로 이동" aria-label="물건 위로 이동">↑</button>
        <button type="button" class="btn-item-action btn-move-down" title="아래로 이동" aria-label="물건 아래로 이동">↓</button>
        <button type="button" class="btn-text-danger btn-delete-item">삭제</button>
      </div>
    </div>
    <div class="item-card-body">
      <!-- Line 1: 물건명 | 구조 및 규격 | 수량 | 단위 -->
      <div class="item-card-row-1">
        <div class="form-group">
          <input type="text" class="cell-name" placeholder="물건명 : 컨테이너 창고">
        </div>
        <div class="form-group">
          <textarea class="cell-specs" rows="1" placeholder="구조 및 규격 : 조립식 판넬조 2.5*3m"></textarea>
        </div>
        <div class="form-group">
          <input type="text" class="cell-qty" inputmode="decimal" placeholder="수량" style="text-align: right;">
        </div>
        <div class="form-group">
          <select class="cell-unit">
            ${unitOptionsHtml}
          </select>
          <input type="text" class="cell-unit-custom ${isCustomUnit ? '' : 'hidden'}" placeholder="단위 직접 입력" style="width: 70px;">
        </div>
      </div>
      
      <!-- Line 2: 비고 -->
      <div class="item-card-row-2 remarks-row hidden">
        <div class="form-group">
          <input type="text" class="cell-remarks" placeholder="비고">
        </div>
      </div>
    </div>
  `;
  
  const previousCard = insertAfterId === null ? null : document.getElementById(`item-card-${insertAfterId}`);
  if (previousCard) {
    previousCard.insertAdjacentElement('afterend', card);
  } else {
    container.appendChild(card);
  }
  lucide.createIcons({ attrs: { class: 'lucide-icon-sm' } });
  
  card.querySelector('.cell-name').value = rowObj.name || '';
  card.querySelector('.cell-specs').value = rowObj.specs || '';
  card.querySelector('.cell-qty').value = rowObj.qty ?? '';
  card.querySelector('.cell-unit-custom').value = isCustomUnit ? rowObj.unit : '';
  card.querySelector('.cell-remarks').value = rowObj.remarks || '';
  card.querySelector('.cell-location').value = rowObj.location || '';
  card.querySelector('.cell-ledger').checked = !!rowObj.hasLedger;
  card.querySelector('.cell-business').checked = !!rowObj.isBusiness;
  card.querySelector('.cell-residence').checked = !!rowObj.isResidence;
  
  const selectType = card.querySelector('.cell-type');
  const selectUnit = card.querySelector('.cell-unit');
  const inputUnitCustom = card.querySelector('.cell-unit-custom');
  const remarksRow = card.querySelector('.remarks-row');
  const remarksInput = card.querySelector('.cell-remarks');
  const toggleRemarksButton = card.querySelector('.btn-toggle-remarks');

  function setRemarksVisible(visible) {
    remarksRow.classList.toggle('hidden', !visible);
    toggleRemarksButton.innerText = visible ? '비고 닫기' : '+ 비고';
    toggleRemarksButton.title = visible ? '비고 입력 닫기' : '비고 입력 열기';
    toggleRemarksButton.classList.toggle('has-value', !!remarksInput.value.trim());
  }

  setRemarksVisible(!!(rowObj.remarks || '').trim());
  
  // Handle dropdown triggers
  selectType.addEventListener('change', (e) => {
    rowObj.type = e.target.value;
    syncItemData(currentId);
  });
  
  selectUnit.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      inputUnitCustom.classList.remove('hidden');
      rowObj.unit = '';
    } else {
      inputUnitCustom.classList.add('hidden');
      rowObj.unit = e.target.value;
    }
    syncItemData(currentId);
  });
  
  inputUnitCustom.addEventListener('input', (e) => {
    rowObj.unit = e.target.value;
    syncItemData(currentId);
  });
  
  // Bind simple text fields
  card.querySelector('.cell-name').addEventListener('input', (e) => {
    rowObj.name = e.target.value;
    syncItemData(currentId);
  });
  
  const specsEl = card.querySelector('.cell-specs');
  specsEl.addEventListener('input', (e) => {
    rowObj.specs = e.target.value;
    syncItemData(currentId);
    
    // Auto-grow height based on content
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  });
  
  card.querySelector('.cell-qty').addEventListener('input', (e) => {
    rowObj.qty = e.target.value;
    syncItemData(currentId);
  });
  
  remarksInput.addEventListener('input', (e) => {
    rowObj.remarks = e.target.value;
    toggleRemarksButton.classList.toggle('has-value', !!e.target.value.trim());
    syncItemData(currentId);
  });

  toggleRemarksButton.addEventListener('click', () => {
    const nextVisible = remarksRow.classList.contains('hidden');
    setRemarksVisible(nextVisible);
    if (nextVisible) remarksInput.focus();
  });
  
  card.querySelector('.cell-location').addEventListener('input', (e) => {
    rowObj.location = e.target.value;
    syncItemData(currentId);
  });
  
  card.querySelector('.cell-ledger').addEventListener('change', (e) => {
    rowObj.hasLedger = e.target.checked;
    syncItemData(currentId);
  });
  
  card.querySelector('.cell-business').addEventListener('change', (e) => {
    rowObj.isBusiness = e.target.checked;
    syncItemData(currentId);
  });
  
  card.querySelector('.cell-residence').addEventListener('change', (e) => {
    rowObj.isResidence = e.target.checked;
    syncItemData(currentId);
  });

  card.querySelector('.btn-calc-qty').addEventListener('click', () => {
    calculateQuantityFromSpecs(rowObj, card);
  });
  
  // Delete action
  card.querySelector('.btn-delete-item').addEventListener('click', () => {
    deleteTableRow(currentId, card);
  });
  card.querySelector('.btn-duplicate-item').addEventListener('click', () => {
    addTableDataRow(rowObj, currentId, { focusName: true });
    log(`물건 #${db.items.findIndex(item => item.id === currentId) + 1} 복제 완료`);
  });
  card.querySelector('.btn-move-up').addEventListener('click', () => moveTableRow(currentId, -1));
  card.querySelector('.btn-move-down').addEventListener('click', () => moveTableRow(currentId, 1));
  
  updateRowNumbers();
  updatePhotoCards();
  if (options.focusName) {
    setTimeout(() => {
      const nameInput = card.querySelector('.cell-name');
      if (!nameInput) return;
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      nameInput.focus();
      nameInput.select();
    }, 0);
  }
  log(`${sourceItem ? '지장물 항목 복제' : '지장물 항목 추가'} (ID: ${currentId})`);
}

// Delete Item card
function deleteTableRow(id, cardElement) {
  const index = db.items.findIndex(item => item.id === id);
  if (index !== -1) {
    db.items.splice(index, 1);
    cardElement.remove();
    updateRowNumbers();
    updatePhotoCards();
    log(`지장물 항목 삭제 (ID: ${id})`);
  }
}

function moveTableRow(id, direction) {
  const currentIndex = db.items.findIndex(item => item.id === id);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= db.items.length) return;

  const [item] = db.items.splice(currentIndex, 1);
  db.items.splice(targetIndex, 0, item);

  const card = document.getElementById(`item-card-${id}`);
  const targetItem = db.items[direction < 0 ? targetIndex + 1 : targetIndex - 1];
  const targetCard = document.getElementById(`item-card-${targetItem.id}`);
  if (direction < 0) {
    targetCard.insertAdjacentElement('beforebegin', card);
  } else {
    targetCard.insertAdjacentElement('afterend', card);
  }

  updateRowNumbers();
  updatePhotoCards();
  log(`물건 순서 변경: #${currentIndex + 1} → #${targetIndex + 1}`);
}

// Re-index row numbers displayed in the HTML cards list
function updateRowNumbers() {
  const cards = document.querySelectorAll('#itemCardsList .item-form-card');
  cards.forEach((card, i) => {
    card.querySelector('.item-num').innerText = `물건 #${i + 1}`;
    card.querySelector('.btn-move-up').disabled = i === 0;
    card.querySelector('.btn-move-down').disabled = i === cards.length - 1;
  });
  document.getElementById('photoBadge').innerText = db.items.length;
}

// When item values change, trigger update in Photo Log
function syncItemData(id) {
  const item = db.items.find(i => i.id === id);
  if (!item) return;
  
  const cardElement = document.querySelector(`.photo-card[data-item-id="${id}"]`);
  if (cardElement) {
    const titleEl = cardElement.querySelector('.photo-card-title');
    titleEl.innerText = `${item.type || '미지정'} - ${item.name || '미입력'} [${item.specs || '규격 없음'}]`;
    
    // Sync to card inputs in Tab 3 if not customized
    const nameInput = cardElement.querySelector('.card-name');
    if (nameInput && item.customName === undefined) {
      nameInput.value = item.name || '';
    }
    const qtyInput = cardElement.querySelector('.card-qty');
    if (qtyInput && item.customQty === undefined) {
      qtyInput.value = item.qty || '';
    }
    const unitInput = cardElement.querySelector('.card-unit');
    if (unitInput && item.customUnit === undefined) {
      unitInput.value = item.unit || '';
    }
    const specsInput = cardElement.querySelector('.card-specs');
    if (specsInput && item.customSpecs === undefined) {
      specsInput.value = item.specs || '';
    }
    const locInput = cardElement.querySelector('.card-location');
    if (locInput && item.customLocation === undefined) {
      locInput.value = item.location || compactAddressFromDong(db.survey.location) || '';
    }
    
    // If there is an image loaded, re-draw overlay since text information changed
    if (item.image) {
      drawCompositeImage(item);
    }
  }
}

// Update survey header titles at the top of Photo Log
function syncSurveyHeadersToPhotos() {
  const ownerLabel = getOwnerDisplayName() || 'OOO';
  const locLabel = compactAddressFromDong(db.survey.location) || 'OO동 OOO-OOO';
  log(`소재지/소유자/지구명 동기화 수행: 소유자: ${ownerLabel}, 주소: ${locLabel}`);
  
  // Trigger redraw of overlays for all cards since location info changed
  db.items.forEach(item => {
    // Dynamically update card input values
    const cardEl = document.querySelector(`.photo-card[data-item-id="${item.id}"]`);
    if (cardEl) {
      const locInput = cardEl.querySelector('.card-location');
      if (locInput && item.customLocation === undefined) {
        locInput.value = item.location || compactAddressFromDong(db.survey.location) || '';
      }
      
      const ownerInput = cardEl.querySelector('.card-owner');
      if (ownerInput && item.customOwner === undefined) {
        ownerInput.value = getOwnerDisplayName() || '';
      }
    }
    
    if (item.image && item.overlayEnabled) {
      drawCompositeImage(item);
    }
  });
}

// Regenerate Photo Cards in Tab 3 matching Tab 2 items
function updatePhotoCards() {
  const grid = document.getElementById('photoCardsGrid');
  
  // Capture current open card input files or states to prevent resetting on structural updates
  const uploadsMap = {};
  db.items.forEach(item => {
    uploadsMap[item.id] = {
      image: item.image,
      compositeImage: item.compositeImage,
      overlayEnabled: item.overlayEnabled
    };
  });
  
  grid.innerHTML = '';
  
  if (db.items.length === 0) {
    grid.innerHTML = `
      <div class="alert-info-box" style="background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.15);">
        <i data-lucide="alert-circle" style="color: var(--danger);"></i>
        <p style="color: var(--text-secondary);">물건내역이 비어 있습니다. <strong>[물건내역 작성] 탭</strong>에서 지장물을 먼저 입력해 주세요.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  db.items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.setAttribute('data-item-id', item.id);
    
    card.innerHTML = `
      <div class="photo-card-info-header">
        <span class="photo-card-num">사진 #${index + 1}</span>
        <span class="photo-card-title">${item.type || '미지정'} - ${item.name || '미입력'} [${item.specs || '규격 없음'}]</span>
      </div>
      <div class="photo-card-body">
        <!-- Photo input/preview col -->
        <div class="photo-card-photo-col">
          <div class="composite-preview-wrapper ${item.compositeImage ? '' : 'hidden'}" id="preview-wrapper-${item.id}">
            ${item.compositeImage ? 
              `<img src="data:image/jpeg;base64,${item.compositeImage}" alt="합성 이미지 미리보기">` : 
              ''
            }
          </div>
          <div class="card-file-input-container" style="margin-top: 4px;">
            <input type="file" class="card-file-input" accept="image/*" data-item-id="${item.id}">
          </div>
        </div>
        
        <!-- Controls and settings col -->
        <div class="photo-card-settings-col">
          <div class="toggle-group">
            <label>보드판 표 합성</label>
            <label class="switch">
              <input type="checkbox" class="toggle-overlay" data-item-id="${item.id}" ${item.overlayEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          
          <div class="form-grid" style="gap: 10px;">
            <div class="form-group">
              <label>소재지 (물건내역 연동)</label>
              <input type="text" class="card-location" data-item-id="${item.id}" value="${item.customLocation !== undefined ? item.customLocation : (item.location || compactAddressFromDong(db.survey.location) || '')}" placeholder="소재지 입력">
            </div>
            <div class="form-group">
              <label>소유자 (기본조사서 연동)</label>
              <input type="text" class="card-owner" data-item-id="${item.id}" value="${item.customOwner !== undefined ? item.customOwner : (getOwnerDisplayName() || '')}" placeholder="소유자 입력">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>물건명</label>
              <input type="text" class="card-name" data-item-id="${item.id}" value="${item.customName !== undefined ? item.customName : (item.name || '')}" placeholder="물건명">
            </div>
            <div class="form-group">
              <label>수량</label>
              <input type="text" class="card-qty" data-item-id="${item.id}" value="${item.customQty !== undefined ? item.customQty : (item.qty || '')}" placeholder="수량" style="text-align: right;">
            </div>
            <div class="form-group">
              <label>단위</label>
              <input type="text" class="card-unit" data-item-id="${item.id}" value="${item.customUnit !== undefined ? item.customUnit : (item.unit || '')}" placeholder="단위">
            </div>
          </div>

          <div class="form-group">
            <label>구조 및 규격</label>
            <input type="text" class="card-specs" data-item-id="${item.id}" value="${item.customSpecs !== undefined ? item.customSpecs : (item.specs || '')}" placeholder="구조 및 규격 입력">
          </div>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
    
    // Bind Events to card inputs
    const fileInput = card.querySelector('.card-file-input');
    const overlayToggle = card.querySelector('.toggle-overlay');
    const locInput = card.querySelector('.card-location');
    const ownerInput = card.querySelector('.card-owner');
    const nameInput = card.querySelector('.card-name');
    const qtyInput = card.querySelector('.card-qty');
    const unitInput = card.querySelector('.card-unit');
    const specsInput = card.querySelector('.card-specs');
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      log(`지장물 사진 업로드 (슬롯 ${index + 1}): ${file.name}`);
      try {
        const b64 = await fileToBase64(file);
        item.image = b64;
        
        // Draw the image and apply overlay if configured
        drawCompositeImage(item);
      } catch (err) {
        log('이미지 변환 실패', 'error');
      }
    });
    
    overlayToggle.addEventListener('change', (e) => {
      item.overlayEnabled = e.target.checked;
      log(`사진 #${index + 1} 보드판 합성: ${item.overlayEnabled ? 'ON' : 'OFF'}`);
      if (item.image) {
        drawCompositeImage(item);
      }
    });
    
    locInput.addEventListener('input', (e) => {
      item.customLocation = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });
    
    ownerInput.addEventListener('input', (e) => {
      item.customOwner = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });

    nameInput.addEventListener('input', (e) => {
      item.customName = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });

    qtyInput.addEventListener('input', (e) => {
      item.customQty = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });

    unitInput.addEventListener('input', (e) => {
      item.customUnit = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });
    
    specsInput.addEventListener('input', (e) => {
      item.customSpecs = e.target.value;
      if (item.image && item.overlayEnabled) {
        drawCompositeImage(item);
      }
    });
  });
  
  lucide.createIcons();
}

// Canvas Rendering: Synthesize original photo and board legend together
function drawCompositeImage(item) {
  const canvas = document.getElementById('synthesisCanvas');
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  img.src = `data:image/jpeg;base64,${item.image}`;
  
  img.onload = () => {
    // Set canvas dimensions to match the image dimensions to preserve quality
    canvas.width = img.width;
    canvas.height = img.height;
    
    // 1. Draw base photo
    ctx.drawImage(img, 0, 0);
    
    // 2. Draw overlay board if enabled
    if (item.overlayEnabled) {
      // Margins
      const margin = 20;
      
      // Calculate heights and widths dynamically
      const labelsColWidth = Math.max(canvas.width * 0.12, 100);
      const valuesColWidth = Math.max(canvas.width * 0.35, 260);
      const tableWidth = labelsColWidth + valuesColWidth;
      
      const rowHeight = Math.max(canvas.height * 0.045, 32);
      const tableHeight = rowHeight * 5;
      
      const distX = margin;
      const distY = canvas.height - tableHeight - margin;
      
      // 1. Draw Table Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(distX, distY, tableWidth, tableHeight);
      
      // 2. Draw Table Borders and Grid Lines
      ctx.strokeStyle = '#000000'; // Black border
      ctx.lineWidth = Math.max(canvas.width * 0.003, 3);
      ctx.strokeRect(distX, distY, tableWidth, tableHeight);
      
      // Draw vertical separator
      ctx.beginPath();
      ctx.moveTo(distX + labelsColWidth, distY);
      ctx.lineTo(distX + labelsColWidth, distY + tableHeight);
      ctx.stroke();
      
      // Draw horizontal row separators
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(distX, distY + (rowHeight * i));
        ctx.lineTo(distX + tableWidth, distY + (rowHeight * i));
        ctx.stroke();
      }
      
      // 3. Draw Text
      const fontSize = Math.max(rowHeight * 0.45, 13);
      ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textBaseline = 'middle';
      
      const labels = ['사업지구명', '소 재 지', '물건내용', '소 유 자', '조사일자'];
      
      const districtVal = db.survey.district || '';
      const locationVal = compactAddressFromDong(item.customLocation !== undefined ? item.customLocation : (item.location || db.survey.location || ''));
      const descVal = getCompositeItemDesc(item);
      const ownerVal = item.customOwner !== undefined ? item.customOwner : (getOwnerDisplayName() || '');
      const dateVal = db.survey.date || new Date().toISOString().split('T')[0];
      
      const values = [districtVal, locationVal, descVal, ownerVal, dateVal];
      const textPadding = 12;
      
      for (let i = 0; i < 5; i++) {
        const rowY = distY + (rowHeight * i) + (rowHeight / 2);
        
        // Draw Label (Black)
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], distX + (labelsColWidth / 2), rowY);
        
        // Draw Value (Black) with clipping to prevent overflow
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.save();
        ctx.beginPath();
        ctx.rect(distX + labelsColWidth + textPadding, distY + (rowHeight * i), valuesColWidth - (textPadding * 2), rowHeight);
        ctx.clip();
        ctx.fillText(values[i], distX + labelsColWidth + textPadding, rowY);
        ctx.restore();
      }
    }
    
    // Save synthesized Base64 JPEG (Quality 0.8)
    const compositeBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    item.compositeImage = item.overlayEnabled ? compositeBase64 : item.image;
    
    // Update HTML preview wrapper immediately
    const previewWrapper = document.getElementById(`preview-wrapper-${item.id}`);
    if (previewWrapper) {
      previewWrapper.innerHTML = `<img src="data:image/jpeg;base64,${item.compositeImage}" alt="합성 이미지 미리보기">`;
      previewWrapper.classList.remove('hidden');
    }
    setItemPhotoPreview(item);
  };
}

function rebuildSurveyWorksheet(workbook, wsSurvey) {
  wsSurvey.name = '기본조사서';

  const existingMerges = [...((wsSurvey.model && wsSurvey.model.merges) || [])];
  existingMerges.forEach(range => {
    try { wsSurvey.unMergeCells(range); } catch (e) {}
  });

  for (let r = 1; r <= 55; r++) {
    const row = wsSurvey.getRow(r);
    row.height = undefined;
    for (let c = 1; c <= 32; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = {};
    }
  }

  wsSurvey.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }
  };

  wsSurvey.columns = Array.from({ length: 32 }, () => ({ width: 3.2 }));
  [4, 8, 12, 16, 20, 24, 28, 32].forEach(col => {
    wsSurvey.getColumn(col).width = 4.2;
  });

  const colors = {
    title: 'FFFFFF',
    section: 'FFFFFF',
    label: 'FFFFFF',
    value: 'FFFFFF',
    border: '94A3B8',
    muted: 'FFFFFF'
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: colors.border } },
    left: { style: 'thin', color: { argb: colors.border } },
    bottom: { style: 'thin', color: { argb: colors.border } },
    right: { style: 'thin', color: { argb: colors.border } }
  };

  const merge = (range, value, options = {}) => {
    try { wsSurvey.mergeCells(range); } catch (e) {}
    const cell = wsSurvey.getCell(range.split(':')[0]);
    cell.value = value || '';
    cell.font = options.font || { name: '맑은 고딕', size: 10 };
    cell.alignment = options.alignment || { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options.fill || colors.value }
    };
    cell.border = thinBorder;
    return cell;
  };

  const section = (range, value) => merge(range, value, {
    fill: colors.section,
    font: { name: '맑은 고딕', size: 11, bold: true, color: { argb: '000000' } }
  });
  const label = (range, value) => merge(range, value, {
    fill: colors.label,
    font: { name: '맑은 고딕', size: 10, bold: true, color: { argb: '000000' } }
  });
  const value = (range, text, align = 'left') => merge(range, text, {
    fill: colors.value,
    font: { name: '맑은 고딕', size: 10, color: { argb: '000000' } },
    alignment: { vertical: 'middle', horizontal: align, wrapText: true }
  });

  wsSurvey.getRow(1).height = 24;
  wsSurvey.getRow(2).height = 24;
  merge('A1:AF2', '기본조사서', {
    fill: colors.title,
    font: { name: '맑은 고딕', size: 18, bold: true, color: { argb: '000000' } },
    alignment: { vertical: 'middle', horizontal: 'center' }
  });

  section('A3:AF3', '기본정보 및 사업자 정보');
  label('A4:D4', '사업지구명');
  value('E4:P4', db.survey.district || '');
  label('Q4:T4', '소유자 성명');
  value('U4:AF4', getOwnerDisplayName() || '');
  label('A5:D5', '주민등록번호');
  value('E5:P5', db.survey.repJumin || '');
  label('Q5:T5', '전화번호');
  value('U5:AF5', db.survey.repContact || '');
  label('A6:D6', '상호');
  value('E6:P6', db.survey.company || '');
  label('Q6:T6', '대표자');
  value('U6:AF6', db.survey.repName || '');
  label('A7:D7', '사업자번호');
  value('E7:P7', db.survey.bizRegNo || '');
  label('Q7:T7', '법인번호');
  value('U7:AF7', db.survey.corpRegNo || '');
  label('A8:D8', '업종');
  value('E8:P8', db.survey.bizType || '');
  label('Q8:T8', '업태');
  value('U8:AF8', db.survey.bizStatus || '');
  label('A9:D9', '기타 허가사항');
  value('E9:AF9', db.survey.permitNotes || '');

  const locationVal = addOutOfDistrictMarker(formatExcelAddress(
    db.survey.location,
    db.survey.locationRoad,
    db.survey.locationZip,
    db.survey.locationDetail,
    db.survey.locationJibun
  ), db.survey.outOfDistrict);
  const repVal = addOutOfDistrictMarker(formatExcelAddress(
    db.survey.repAddr,
    db.survey.repRoad,
    db.survey.repZip,
    db.survey.repDetail,
    db.survey.repJibun
  ), db.survey.repOutOfDistrict);
  const bizLocationVal = addOutOfDistrictMarker(formatExcelAddress(
    db.survey.bizLocation,
    db.survey.bizLocationRoad,
    db.survey.bizLocationZip,
    db.survey.bizLocationDetail,
    db.survey.bizLocationJibun
  ), db.survey.bizOutOfDistrict);

  section('A10:AF10', '주소 정보');
  wsSurvey.getRow(11).height = 30;
  wsSurvey.getRow(12).height = 30;
  wsSurvey.getRow(13).height = 30;
  wsSurvey.getRow(14).height = 30;
  wsSurvey.getRow(15).height = 30;
  wsSurvey.getRow(16).height = 30;
  label('A11:D12', '물건 소재지');
  value('E11:AF12', locationVal);
  label('A13:D14', '송달주소');
  value('E13:AF14', repVal);
  label('A15:D16', '사업자등록증상 소재지');
  value('E15:AF16', bizLocationVal);

  const yn = checked => checked ? 'Y' : 'N';
  section('A17:AF17', '조사 체크 정보');
  label('A18:D18', '지구외');
  label('E18:H18', '자가/임차');
  label('I18:L18', '건축물대장');
  label('M18:P18', '영업장');
  label('Q18:T18', '거주');
  label('U18:X18', '전기');
  label('Y18:AB18', '수도');
  label('AC18:AF18', '정화조');
  value('A19:D19', yn(db.survey.outOfDistrict), 'center');
  value('E19:H19', db.survey.rentType || '', 'center');
  value('I19:L19', yn(db.survey.hasLedger), 'center');
  value('M19:P19', yn(db.survey.isBusiness), 'center');
  value('Q19:T19', yn(db.survey.isResidence), 'center');
  value('U19:X19', yn(db.survey.hasElectricity), 'center');
  value('Y19:AB19', yn(db.survey.hasWater), 'center');
  value('AC19:AF19', yn(db.survey.hasSeptic), 'center');

  section('A21:AF21', '평면도 및 현장사진');
  wsSurvey.getRow(22).height = 22;
  for (let r = 23; r <= 41; r++) wsSurvey.getRow(r).height = 18;
  wsSurvey.getRow(42).height = 22;
  merge('A22:AF42', db.survey.photo ? '' : '평면도 또는 현장사진이 등록되지 않았습니다.', {
    fill: colors.muted,
    font: { name: '맑은 고딕', size: 11, color: { argb: '000000' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
  });

  if (db.survey.photo) {
    const imgId = workbook.addImage({
      base64: db.survey.photo,
      extension: 'jpeg'
    });
    wsSurvey.addImage(imgId, {
      tl: { col: 0.2, row: 21.2 },
      br: { col: 31.8, row: 41.8 }
    });
  }

  section('A43:AF43', '특기사항');
  for (let r = 44; r <= 48; r++) wsSurvey.getRow(r).height = 20;
  value('A44:AF48', db.survey.notes || '');

  section('A50:AF50', '서명 정보');
  label('A51:D51', '조사일자');
  value('E51:L51', db.survey.date || '', 'center');
  label('M51:P51', '조사자 성명');
  value('Q51:X51', db.survey.surveyor || '', 'center');
  label('Y51:AB51', '입회자 성명');
  value('AC51:AF51', db.survey.witness || '', 'center');
  label('A52:D52', '확인자 성명');
  value('E52:L52', getOwnerDisplayName() || '', 'center');
  value('M52:AF52', '(인)', 'right');

  wsSurvey.views = [{ showGridLines: false }];
}

function getExcelImageExtension(mimeType, extension) {
  const ext = (extension || '').toLowerCase();
  const type = (mimeType || '').toLowerCase();
  if (type.includes('png') || ext === 'png') return 'png';
  if (type.includes('jpg') || type.includes('jpeg') || ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  return '';
}

function rebuildDocumentsWorksheet(workbook) {
  const existing = workbook.getWorksheet('추가제출서류');
  if (existing) workbook.removeWorksheet(existing.id);

  const wsDocs = workbook.addWorksheet('추가제출서류');
  wsDocs.views = [{ showGridLines: false }];
  wsDocs.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }
  };

  wsDocs.columns = [
    { width: 6 },
    { width: 22 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 38 }
  ];

  const border = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  wsDocs.mergeCells('A1:G1');
  const title = wsDocs.getCell('A1');
  title.value = '추가 제출서류 정리';
  title.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: '000000' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
  title.border = border;
  wsDocs.getRow(1).height = 30;

  [
    ['소유자', getOwnerDisplayName() || '', '물건 소재지', compactAddressFromDong(db.survey.location) || ''],
    ['조사일자', db.survey.date || '', '조사자', db.survey.surveyor || '']
  ].forEach((rowValues, index) => {
    const row = wsDocs.getRow(index + 2);
    row.values = rowValues;
    row.height = 22;
    row.eachCell((cell, col) => {
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: col % 2 === 1 ? 'center' : 'left', wrapText: true };
      cell.font = { name: '맑은 고딕', size: 10, bold: col % 2 === 1, color: { argb: '000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF' }
      };
    });
  });

  const header = wsDocs.getRow(5);
  header.values = ['번호', '저장 파일명', '원본 파일명', '확장자', '등록여부', '미리보기', '비고'];
  header.height = 24;
  header.eachCell(cell => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
    cell.border = border;
  });

  const docs = db.documents.length ? db.documents : [{
    filename: '',
    originalName: '',
    extension: '',
    mimeType: '',
    image: ''
  }];

  docs.forEach((documentItem, index) => {
    const rowNum = 6 + (index * 9);
    for (let r = rowNum; r < rowNum + 9; r++) {
      wsDocs.getRow(r).height = 18;
      for (let c = 1; c <= 7; c++) {
        const cell = wsDocs.getRow(r).getCell(c);
        cell.border = border;
        cell.font = { name: '맑은 고딕', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: c === 7 ? 'left' : 'center', wrapText: true };
      }
    }

    wsDocs.mergeCells(`A${rowNum}:A${rowNum + 8}`);
    wsDocs.mergeCells(`B${rowNum}:B${rowNum + 8}`);
    wsDocs.mergeCells(`C${rowNum}:C${rowNum + 8}`);
    wsDocs.mergeCells(`D${rowNum}:D${rowNum + 8}`);
    wsDocs.mergeCells(`E${rowNum}:E${rowNum + 8}`);
    wsDocs.mergeCells(`F${rowNum}:F${rowNum + 8}`);
    wsDocs.mergeCells(`G${rowNum}:G${rowNum + 8}`);

    wsDocs.getCell(`A${rowNum}`).value = index + 1;
    wsDocs.getCell(`B${rowNum}`).value = documentItem.filename
      ? `${sanitizeFilename(documentItem.filename, `추가제출서류_${index + 1}`)}.${documentItem.extension || 'jpg'}`
      : '';
    wsDocs.getCell(`C${rowNum}`).value = documentItem.originalName || '';
    wsDocs.getCell(`D${rowNum}`).value = documentItem.extension || '';
    wsDocs.getCell(`E${rowNum}`).value = documentItem.image ? '등록' : '미등록';
    wsDocs.getCell(`G${rowNum}`).value = documentItem.image ? '' : '추가 제출서류 사진이 등록되지 않았습니다.';

    const imageExt = getExcelImageExtension(documentItem.mimeType, documentItem.extension);
    if (documentItem.image && imageExt) {
      const imgId = workbook.addImage({
        base64: documentItem.image,
        extension: imageExt
      });
      wsDocs.addImage(imgId, {
        tl: { col: 5.1, row: rowNum - 0.85 },
        br: { col: 5.9, row: rowNum + 7.9 }
      });
    } else if (documentItem.image) {
      wsDocs.getCell(`G${rowNum}`).value = '엑셀 미리보기는 JPG/PNG만 지원합니다. 원본 파일은 ZIP 폴더에 저장됩니다.';
    }
  });
}

function applyTableCellStyle(cell, options = {}) {
  cell.font = options.font || { name: '맑은 고딕', size: 10 };
  cell.alignment = options.alignment || { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: options.fill || 'FFFFFF' }
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };
}

function rebuildItemsWorksheet(workbook) {
  const wsItems = workbook.addWorksheet('물건내역');
  wsItems.views = [{ showGridLines: false }];
  wsItems.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }
  };

  wsItems.columns = [
    { width: 6 },
    { width: 14 },
    { width: 22 },
    { width: 34 },
    { width: 10 },
    { width: 10 },
    { width: 24 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 12 }
  ];

  wsItems.mergeCells('A1:K1');
  const title = wsItems.getCell('A1');
  title.value = '물건내역';
  applyTableCellStyle(title, {
    fill: 'FFFFFF',
    font: { name: '맑은 고딕', size: 16, bold: true, color: { argb: '000000' } },
    alignment: { vertical: 'middle', horizontal: 'center' }
  });
  wsItems.getRow(1).height = 30;

  wsItems.mergeCells('A2:B2');
  wsItems.getCell('A2').value = '소유자';
  wsItems.mergeCells('C2:E2');
  wsItems.getCell('C2').value = getOwnerDisplayName() || '';
  wsItems.mergeCells('F2:G2');
  wsItems.getCell('F2').value = '물건 소재지';
  wsItems.mergeCells('H2:K2');
  wsItems.getCell('H2').value = compactAddressFromDong(db.survey.location) || '';
  ['A2', 'C2', 'F2', 'H2'].forEach(ref => {
    applyTableCellStyle(wsItems.getCell(ref), {
      fill: 'FFFFFF',
      font: { name: '맑은 고딕', size: 10, bold: ['A2', 'F2'].includes(ref), color: { argb: '000000' } },
      alignment: { vertical: 'middle', horizontal: ['A2', 'F2'].includes(ref) ? 'center' : 'left', wrapText: true }
    });
  });

  const headers = ['번호', '물건유형', '물건명', '구조 및 규격', '수량', '단위', '비고', '물건 소재지', '건축물대장', '영업장', '거주'];
  const headerRow = wsItems.getRow(4);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    applyTableCellStyle(cell, {
      fill: 'FFFFFF',
      font: { name: '맑은 고딕', size: 10, bold: true, color: { argb: '000000' } }
    });
  });

  const rows = db.items.length ? db.items : [{
    type: '',
    name: '',
    specs: '',
    qty: '',
    unit: '',
    remarks: '',
    location: '',
    hasLedger: false,
    isBusiness: false,
    isResidence: false
  }];

  rows.forEach((item, index) => {
    const row = wsItems.getRow(5 + index);
    row.height = 28;
    row.values = [
      index + 1,
      item.type || '',
      item.name || '',
      item.specs || '',
      item.qty || '',
      item.unit || '',
      item.remarks || '',
      compactAddressFromDong(item.location || db.survey.location || ''),
      item.hasLedger ? 'Y' : 'N',
      item.isBusiness ? 'Y' : 'N',
      item.isResidence ? 'Y' : 'N'
    ];
    row.eachCell((cell, col) => {
      applyTableCellStyle(cell, {
        fill: 'FFFFFF',
        alignment: {
          vertical: 'middle',
          horizontal: [3, 4, 7, 8].includes(col) ? 'left' : 'center',
          wrapText: true
        }
      });
    });
  });

  return wsItems;
}

function rebuildPhotoWorksheet(workbook) {
  const wsPhotos = workbook.addWorksheet('사진대지');
  wsPhotos.views = [{ showGridLines: false }];
  wsPhotos.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }
  };
  wsPhotos.columns = Array.from({ length: 12 }, () => ({ width: 8 }));

  wsPhotos.mergeCells('A1:L1');
  applyTableCellStyle(wsPhotos.getCell('A1'), {
    fill: 'FFFFFF',
    font: { name: '맑은 고딕', size: 16, bold: true, color: { argb: '000000' } },
    alignment: { vertical: 'middle', horizontal: 'center' }
  });
  wsPhotos.getCell('A1').value = '사진대지';
  wsPhotos.getRow(1).height = 30;

  wsPhotos.mergeCells('A2:B2');
  wsPhotos.getCell('A2').value = '소유자';
  wsPhotos.mergeCells('C2:F2');
  wsPhotos.getCell('C2').value = getOwnerDisplayName() || '';
  wsPhotos.mergeCells('G2:H2');
  wsPhotos.getCell('G2').value = '소재지';
  wsPhotos.mergeCells('I2:L2');
  wsPhotos.getCell('I2').value = compactAddressFromDong(db.survey.location) || '';
  ['A2', 'C2', 'G2', 'I2'].forEach(ref => {
    applyTableCellStyle(wsPhotos.getCell(ref), {
      fill: 'FFFFFF',
      font: { name: '맑은 고딕', size: 10, bold: ['A2', 'G2'].includes(ref), color: { argb: '000000' } },
      alignment: { vertical: 'middle', horizontal: ['A2', 'G2'].includes(ref) ? 'center' : 'left', wrapText: true }
    });
  });

  const items = db.items.length ? db.items : [{ name: '', specs: '', qty: '', unit: '', image: '', compositeImage: '' }];
  items.forEach((item, index) => {
    const blockTop = 4 + index * 13;
    const isLeft = index % 2 === 0;
    const colStart = isLeft ? 'A' : 'G';
    const colEnd = isLeft ? 'F' : 'L';
    const labelRow = blockTop + 9;

    wsPhotos.mergeCells(`${colStart}${blockTop}:${colEnd}${blockTop + 8}`);
    wsPhotos.mergeCells(`${colStart}${labelRow}:${colEnd}${labelRow + 2}`);
    for (let r = blockTop; r <= labelRow + 2; r++) {
      wsPhotos.getRow(r).height = r <= blockTop + 8 ? 18 : 20;
      for (let c = isLeft ? 1 : 7; c <= (isLeft ? 6 : 12); c++) {
        applyTableCellStyle(wsPhotos.getRow(r).getCell(c), {
          fill: 'FFFFFF',
          font: { name: '맑은 고딕', size: 10, color: { argb: '000000' } },
          alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
        });
      }
    }

    const desc = getCompositeItemDesc(item) || `사진 #${index + 1}`;
    wsPhotos.getCell(`${colStart}${labelRow}`).value = desc;

    const activePhoto = item.compositeImage || item.image;
    if (activePhoto) {
      const imgId = workbook.addImage({
        base64: activePhoto,
        extension: 'jpeg'
      });
      wsPhotos.addImage(imgId, {
        tl: { col: isLeft ? 0.1 : 6.1, row: blockTop - 0.85 },
        br: { col: isLeft ? 5.9 : 11.9, row: blockTop + 7.8 }
      });
    } else {
      wsPhotos.getCell(`${colStart}${blockTop}`).value = '사진 없음';
    }
  });

  return wsPhotos;
}

// Generate Excel Workbook buffer using ExcelJS
async function generateExcelBuffer() {
  log('엑셀 생성 고속 연동 가동 (깨끗한 새 통합문서)...');

  // Re-read address inputs immediately before export so searched or manually
  // edited values are always reflected in the generated workbook.
  syncAddressFieldsFromForm();
  
  const workbook = new ExcelJS.Workbook();
  
  // 1. 기본조사서
  const wsDigitalSurvey = workbook.addWorksheet('기본조사서');
  log('기본조사서 시트 생성 중...');
  rebuildSurveyWorksheet(workbook, wsDigitalSurvey);
  
  // Set active tab to the first sheet (기본조사서)
  workbook.views = [{ activeTab: 0 }];
  
  // 2. 물건내역
  log('물건내역 시트 생성 중...');
  rebuildItemsWorksheet(workbook);
  
  // 3. 사진대지
  log('사진대지 시트 생성 중...');
  rebuildPhotoWorksheet(workbook);
  
  // 4. 추가제출서류
  log('추가 제출서류 정리 시트 생성 중...');
  rebuildDocumentsWorksheet(workbook);

  return await workbook.xlsx.writeBuffer();
}

// Convert Col Index to Excel Letter (1 -> A, 2 -> B, ...)
function openpyxlColLetter(col) {
  let temp = col;
  let letter = "";
  while (temp > 0) {
    let modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}

async function createZipPackage(type = "blob") {
  const excelBuffer = await generateExcelBuffer();
  const zip = new JSZip();

  const ownerName = getOwnerDisplayName() || db.survey.owner || '공통';
  const dateStr = db.survey.date ? db.survey.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filenameBase = `조사보고서_${ownerName}_${dateStr}`;

  zip.file(`${filenameBase}.xlsx`, excelBuffer);

  const floorPlanFolder = zip.folder("01_평면도");
  if (db.survey.photo) {
    floorPlanFolder.file("00_현장전경_평면도.jpg", base64ToArrayBuffer(db.survey.photo));
  }

  const photoLogFolder = zip.folder("02_사진대지");
  db.items.forEach((item, index) => {
    const activePhoto = item.compositeImage || item.image;
    if (!activePhoto) return;
    const nameClean = sanitizeFilename(item.name || '미입력', '미입력').replace(/[. ]/g, '_');
    photoLogFolder.file(
      `사진_${index + 1}_${nameClean}.jpg`,
      base64ToArrayBuffer(activePhoto)
    );
  });

  const documentsFolder = zip.folder("03_추가제출서류");
  db.documents.forEach((documentItem, index) => {
    if (!documentItem.image) return;
    const filename = sanitizeFilename(documentItem.filename, `추가제출서류_${index + 1}`);
    documentsFolder.file(
      `${String(index + 1).padStart(2, '0')}_${filename}.${documentItem.extension}`,
      base64ToArrayBuffer(documentItem.image)
    );
  });

  if (db.survey.surveyorSignature || db.survey.witnessSignature) {
    const signatureFolder = zip.folder("04_서명");
    if (db.survey.surveyorSignature) {
      signatureFolder.file("조사자_서명.jpg", base64ToArrayBuffer(db.survey.surveyorSignature));
    }
    if (db.survey.witnessSignature) {
      signatureFolder.file("입회자_서명.jpg", base64ToArrayBuffer(db.survey.witnessSignature));
    }
  }

  const content = await zip.generateAsync({ type });
  return { content, filenameBase, ownerName, dateStr };
}

// ZIP Compression and Download trigger
async function downloadZipArchive() {
  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = '20%';
  
  log('ZIP 압축 패키징 준비 중...');
  try {
    const { content, filenameBase } = await createZipPackage("blob");
    
    progressBar.style.width = '100%';
    log('다운로드 파일 생성 완료!', 'success');
    
    // Create download trigger
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${filenameBase}.zip`;
    link.click();
    
    setTimeout(() => {
      progressBar.style.width = '0%';
    }, 2000);
    
  } catch (err) {
    log(`작업 실패: ${err.message}`, 'error');
    progressBar.style.width = '0%';
    alert(`파일 생성 실패: ${err.message}`);
  }
}
// Simulated Email Transmit using client-side API
async function sendEmailWithZip() {
  const recipient = document.getElementById('emailRecipient').value.trim();
  if (!recipient) {
    alert('이메일 주소를 먼저 입력해 주세요.');
    return;
  }
  
  log(`이메일 발송 작업 시작 (수신인: ${recipient})...`);
  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = '30%';
  
  try {
    const {
      content: zipBlob,
      filenameBase,
      ownerName,
      dateStr
    } = await createZipPackage("base64");
    progressBar.style.width = '90%';
    
    // --- Google Apps Script / Email Webhook Integration ---
    // ⚠️ 아래 작은따옴표 안에 본인의 구글 웹 앱 URL 주소를 그대로 붙여넣으세요!
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbw3PC2x2h7v2cx3ZyQ6jtfyNiFie1ENzjridqG3DltvRCAco10dYg9OHUQ-JUMMIpK-/exec';
    
    // Real API transmission (수정이나 팝업창 없이 바로 발송)
    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      mode: 'no-cors', // standard for GAS webapps
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipient,
        owner: ownerName,
        date: dateStr,
        subject: `[현장조사보고서] ${ownerName} (${dateStr})`,
        body: `자동 생성된 현장조사 보고서 및 사진 대지 압축파일이 첨부되었습니다.\n\n공사명/소재지: ${db.survey.location || '미지정'}\n조사자: ${db.survey.surveyor || '미입력'}`,
        attachmentBase64: zipBlob,
        attachmentName: `${filenameBase}.zip`
      })
    });
    
    log('구글 앱스 스크립트 메일 발송 API 호출 완료!', 'success');
    alert('구글 앱스 스크립트(Gmail)를 통해 성공적으로 메일이 발송되었습니다.');
    
    setTimeout(() => {
      progressBar.style.width = '0%';
    }, 2000);
    
  } catch (err) {
    log(`메일 발송 실패: ${err.message}`, 'error');
    progressBar.style.width = '0%';
    alert(`메일 전송 실패: ${err.message}`);
  }
}

// --- Drawing Board Feature ---
let drawingState = {
  isDrawing: false,
  tool: 'pen', // pen, line, rect, circle, fill, text, eraser, rect-eraser
  color: '#000000',
  lineWidth: 3,
  lineDash: 'solid', // solid, dashed
  hatchPattern: 'solid',
  fontSize: 16,
  textContent: '',
  history: [],
  historyIndex: -1,
  startX: 0,
  startY: 0,
  points: [] // stores points for pen line correction
};

function initDrawingBoard() {
  const trigger = document.getElementById('btnDrawSurveyPhoto');
  const modal = document.getElementById('drawingModal');
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');
  
  if (!trigger || !modal || !canvas) return;

  // Initialize canvas background to white
  function clearCanvasToWhite() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  }

  // Save history state
  function saveState() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // If we drew something new, truncate any redo history
    if (drawingState.historyIndex < drawingState.history.length - 1) {
      drawingState.history = drawingState.history.slice(0, drawingState.historyIndex + 1);
    }
    drawingState.history.push(data);
    drawingState.historyIndex++;
    // Cap history size to 30 states to conserve memory
    if (drawingState.history.length > 30) {
      drawingState.history.shift();
      drawingState.historyIndex--;
    }
  }

  function undo() {
    if (drawingState.historyIndex > 0) {
      drawingState.historyIndex--;
      ctx.putImageData(drawingState.history[drawingState.historyIndex], 0, 0);
    }
  }

  function redo() {
    if (drawingState.historyIndex < drawingState.history.length - 1) {
      drawingState.historyIndex++;
      ctx.putImageData(drawingState.history[drawingState.historyIndex], 0, 0);
    }
  }

  // Color Swatch Selection
  const swatches = document.querySelectorAll('.color-swatch');
  const colorPicker = document.getElementById('drawingColorPicker');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.getAttribute('data-color');
      drawingState.color = color;
      colorPicker.value = color;
    });
  });
  colorPicker.addEventListener('input', (e) => {
    swatches.forEach(s => s.classList.remove('active'));
    drawingState.color = e.target.value;
  });

  // Tool Selection
  const toolBtns = document.querySelectorAll('.drawing-tool-btn');
  const hatchGroup = document.getElementById('hatchGroup');
  const textInputGroup = document.getElementById('textInputGroup');
  
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.getAttribute('data-tool');
      drawingState.tool = tool;
      
      // Toggle secondary setting displays
      hatchGroup.style.display = (tool === 'fill') ? 'block' : 'none';
      textInputGroup.style.display = (tool === 'text') ? 'block' : 'none';
    });
  });

  // Line Width Selection
  const lineWidthInput = document.getElementById('drawingLineWidth');
  const lineWidthVal = document.getElementById('lineWidthVal');
  lineWidthInput.addEventListener('input', (e) => {
    drawingState.lineWidth = parseInt(e.target.value);
    lineWidthVal.textContent = `${drawingState.lineWidth}px`;
  });

  // Hatch Pattern Selection
  const hatchSelect = document.getElementById('drawingHatchPattern');
  hatchSelect.addEventListener('change', (e) => {
    drawingState.hatchPattern = e.target.value;
  });

  // Line Dash Selection
  const lineDashSelect = document.getElementById('drawingLineDash');
  if (lineDashSelect) {
    lineDashSelect.addEventListener('change', (e) => {
      drawingState.lineDash = e.target.value;
    });
  }

  // Text / Font Selection
  const textInput = document.getElementById('drawingTextContent');
  textInput.addEventListener('input', (e) => {
    drawingState.textContent = e.target.value;
  });
  const fontSizeSelect = document.getElementById('drawingFontSize');
  fontSizeSelect.addEventListener('change', (e) => {
    drawingState.fontSize = parseInt(e.target.value);
  });

  // Open drawing modal
  trigger.addEventListener('click', () => {
    modal.classList.remove('hidden');
    // Clear state
    drawingState.history = [];
    drawingState.historyIndex = -1;
    clearCanvasToWhite();
    
    // Lucide icons rendering
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  });

  // Close drawing modal
  document.getElementById('btnCloseDrawing').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Clear Canvas
  document.getElementById('btnDrawingClear').addEventListener('click', () => {
    if (confirm('그려진 내용을 모두 지우시겠습니까?')) {
      clearCanvasToWhite();
    }
  });

  // Undo/Redo Buttons
  document.getElementById('btnDrawingUndo').addEventListener('click', undo);
  document.getElementById('btnDrawingRedo').addEventListener('click', redo);

  // Coordinate retrieval helper supporting mouse and touch
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    // For scaling canvas if CSS width differs from actual resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // --- FLOOD FILL ALGORITHM (supporting math hatch lines) ---
  function hexToRgba(hex) {
    let r = 0, g = 0, b = 0, a = 255;
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    }
    return { r, g, b, a };
  }

  function floodFill(startX, startY, fillHexColor, patternName) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Convert starting pixel coordinate
    const targetIdx = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const fillRgba = hexToRgba(fillHexColor);

    // If target and fill color are identical, stop to prevent infinite loop
    const colorTolerance = 15; // allowance for minor compression/draw artifacts
    function colorMatch(idx, r, g, b, a) {
      return Math.abs(data[idx] - r) < colorTolerance &&
             Math.abs(data[idx + 1] - g) < colorTolerance &&
             Math.abs(data[idx + 2] - b) < colorTolerance &&
             Math.abs(data[idx + 3] - a) < colorTolerance;
    }

    if (colorMatch(targetIdx, fillRgba.r, fillRgba.g, fillRgba.b, fillRgba.a) && patternName === 'solid') {
      return;
    }

    // Stack-based flood fill (more stable than recursion)
    const pixelStack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);

    // Hatch pattern pixel check
    const isHatchPixel = (x, y) => {
      if (patternName === 'solid') return true;
      const spacing = 12;
      const thickness = 2.5;
      if (patternName === 'hatch-diagonal') {
        return (x + y) % spacing < thickness;
      } else if (patternName === 'hatch-diagonal-back') {
        return Math.abs(x - y) % spacing < thickness;
      } else if (patternName === 'hatch-cross') {
        return (x % spacing < thickness) || (y % spacing < thickness);
      } else if (patternName === 'hatch-dots') {
        return (x % spacing < 2) && (y % spacing < 2);
      }
      return true;
    };

    while (pixelStack.length > 0) {
      const [currX, currY] = pixelStack.pop();
      const idx = (currY * width + currX) * 4;
      const visitedIdx = currY * width + currX;

      if (visited[visitedIdx]) continue;
      visited[visitedIdx] = 1;

      if (colorMatch(idx, targetR, targetG, targetB, targetA)) {
        // Paint pixel depending on hatch check
        if (isHatchPixel(currX, currY)) {
          data[idx] = fillRgba.r;
          data[idx + 1] = fillRgba.g;
          data[idx + 2] = fillRgba.b;
          data[idx + 3] = fillRgba.a;
        } else if (patternName !== 'solid') {
          // If hatch spacing, color it white so we overwrite previous background
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }

        // Push neighbors only if they are within bounds and not yet visited
        if (currX + 1 < width && !visited[currY * width + (currX + 1)]) {
          pixelStack.push([currX + 1, currY]);
        }
        if (currX - 1 >= 0 && !visited[currY * width + (currX - 1)]) {
          pixelStack.push([currX - 1, currY]);
        }
        if (currY + 1 < height && !visited[(currY + 1) * width + currX]) {
          pixelStack.push([currX, currY + 1]);
        }
        if (currY - 1 >= 0 && !visited[(currY - 1) * width + currX]) {
          pixelStack.push([currX, currY - 1]);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveState();
  }

  // --- HAND-DRAWN LINE SMOOTHING & STRAIGHTENING ---
  function simplifyAndStraightenLine(points) {
    if (points.length < 2) return null;
    const start = points[0];
    const end = points[points.length - 1];

    // Compute straight line distance vs cumulative hand path length
    const straightDist = Math.hypot(end.x - start.x, end.y - start.y);
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const ratio = pathLength > 0 ? straightDist / pathLength : 1;

    // Snapping angle logic (Horizontal / Vertical)
    function snapLine(pStart, pEnd) {
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      let snappedEnd = { x: pEnd.x, y: pEnd.y };
      const absAngle = Math.abs(angle);
      const threshold = 8;
      
      if (absAngle < threshold || absAngle > 180 - threshold) {
        snappedEnd.y = pStart.y;
      } else if (Math.abs(absAngle - 90) < threshold) {
        snappedEnd.x = pStart.x;
      }
      return snappedEnd;
    }

    // Straighten line threshold: if ratio is high enough
    if (ratio > 0.88 && straightDist > 15) {
      const snappedEnd = snapLine(start, end);
      return {
        type: 'line',
        start: start,
        end: snappedEnd
      };
    }

    // Otherwise, apply basic Moving Average smoothing to clean up shakiness
    const smoothed = [];
    smoothed.push(start);
    const windowSize = 5;
    for (let i = 1; i < points.length - 1; i++) {
      let sumX = 0, sumY = 0, count = 0;
      const startOffset = Math.max(0, i - Math.floor(windowSize / 2));
      const endOffset = Math.min(points.length - 1, i + Math.floor(windowSize / 2));
      for (let j = startOffset; j <= endOffset; j++) {
        sumX += points[j].x;
        sumY += points[j].y;
        count++;
      }
      smoothed.push({ x: sumX / count, y: sumY / count });
    }
    smoothed.push(end);
    
    return {
      type: 'smooth-path',
      points: smoothed
    };
  }

  // --- DRAWING EVENT LISTENERS ---
  let tempCanvasData = null;

  function drawStart(e) {
    e.preventDefault();
    const coords = getCoordinates(e);
    drawingState.isDrawing = true;
    drawingState.startX = coords.x;
    drawingState.startY = coords.y;
    drawingState.points = [coords];

    if (drawingState.tool === 'fill') {
      floodFill(coords.x, coords.y, drawingState.color, drawingState.hatchPattern);
      drawingState.isDrawing = false;
    } else if (drawingState.tool === 'text') {
      if (drawingState.textContent.trim() === '') {
        alert('좌측 텍스트 입력창에 글자를 기재해 주세요.');
        drawingState.isDrawing = false;
        return;
      }
      ctx.fillStyle = drawingState.color;
      ctx.font = `bold ${drawingState.fontSize}px "맑은 고딕", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(drawingState.textContent, coords.x, coords.y);
      saveState();
      drawingState.isDrawing = false;
    } else {
      tempCanvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = drawingState.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Set line dash
      if (drawingState.tool === 'eraser' || drawingState.tool === 'rect-eraser' || drawingState.lineDash === 'solid') {
        ctx.setLineDash([]);
      } else if (drawingState.lineDash === 'dashed') {
        const dashLen = Math.max(drawingState.lineWidth * 2, 6);
        ctx.setLineDash([dashLen, dashLen]);
      }
      
      ctx.strokeStyle = (drawingState.tool === 'eraser' || drawingState.tool === 'rect-eraser') ? '#ffffff' : drawingState.color;
    }
  }

  function drawMove(e) {
    if (!drawingState.isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);

    if (drawingState.tool === 'pen' || drawingState.tool === 'eraser') {
      ctx.beginPath();
      const lastPoint = drawingState.points[drawingState.points.length - 1];
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      drawingState.points.push(coords);
    } else {
      ctx.putImageData(tempCanvasData, 0, 0);
      ctx.beginPath();
      ctx.lineWidth = drawingState.lineWidth;
      
      // Set line dash preview
      if (drawingState.tool === 'rect-eraser') {
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ef4444'; // Red dashed selection box for eraser
      } else {
        ctx.strokeStyle = drawingState.color;
        if (drawingState.lineDash === 'solid') {
          ctx.setLineDash([]);
        } else if (drawingState.lineDash === 'dashed') {
          const dashLen = Math.max(drawingState.lineWidth * 2, 6);
          ctx.setLineDash([dashLen, dashLen]);
        }
      }
      
      const width = coords.x - drawingState.startX;
      const height = coords.y - drawingState.startY;

      if (drawingState.tool === 'line') {
        ctx.moveTo(drawingState.startX, drawingState.startY);
        ctx.lineTo(coords.x, coords.y);
      } else if (drawingState.tool === 'rect') {
        ctx.rect(drawingState.startX, drawingState.startY, width, height);
      } else if (drawingState.tool === 'circle') {
        const radius = Math.hypot(width, height);
        ctx.arc(drawingState.startX, drawingState.startY, radius, 0, 2 * Math.PI);
      } else if (drawingState.tool === 'rect-eraser') {
        ctx.rect(drawingState.startX, drawingState.startY, width, height);
      }
      ctx.stroke();
    }
  }

  function drawEnd(e) {
    if (!drawingState.isDrawing) return;
    e.preventDefault();
    drawingState.isDrawing = false;

    if (drawingState.tool === 'pen' && drawingState.points.length > 2) {
      const result = simplifyAndStraightenLine(drawingState.points);
      if (result) {
        ctx.putImageData(tempCanvasData, 0, 0);
        ctx.beginPath();
        ctx.lineWidth = drawingState.lineWidth;
        ctx.strokeStyle = drawingState.color;
        
        if (result.type === 'line') {
          ctx.moveTo(result.start.x, result.start.y);
          ctx.lineTo(result.end.x, result.end.y);
          ctx.stroke();
          log('손그림 선이 직선으로 보정되었습니다.', 'success');
        } else if (result.type === 'smooth-path') {
          ctx.moveTo(result.points[0].x, result.points[0].y);
          for (let i = 1; i < result.points.length; i++) {
            ctx.lineTo(result.points[i].x, result.points[i].y);
          }
          ctx.stroke();
        }
      }
    } else if (drawingState.tool === 'rect-eraser') {
      // Clear red dashed preview
      ctx.putImageData(tempCanvasData, 0, 0);
      
      const coords = getCoordinates(e);
      const x = Math.min(drawingState.startX, coords.x);
      const y = Math.min(drawingState.startY, coords.y);
      const w = Math.abs(coords.x - drawingState.startX);
      const h = Math.abs(coords.y - drawingState.startY);
      
      if (w > 2 && h > 2) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w, h);
        log('선택한 영역이 성공적으로 지워졌습니다.', 'success');
      }
    }
    tempCanvasData = null;
    saveState();
  }

  // Bind Mouse Events
  canvas.addEventListener('mousedown', drawStart);
  canvas.addEventListener('mousemove', drawMove);
  canvas.addEventListener('mouseup', drawEnd);
  canvas.addEventListener('mouseleave', drawEnd);

  // Bind Touch Events
  canvas.addEventListener('touchstart', drawStart, { passive: false });
  canvas.addEventListener('touchmove', drawMove, { passive: false });
  canvas.addEventListener('touchend', drawEnd, { passive: false });

  // Save drew canvas to surveyPhoto database
  document.getElementById('btnDrawingSave').addEventListener('click', () => {
    const imgBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    db.survey.photo = imgBase64;
    
    const previewContainer = document.querySelector('#surveyPhotoBox .preview-container');
    const uploadPlaceholder = document.querySelector('#surveyPhotoBox .upload-placeholder');
    const previewImg = document.getElementById('surveyPhotoPreview');
    
    if (previewContainer && uploadPlaceholder && previewImg) {
      previewImg.src = `data:image/jpeg;base64,${imgBase64}`;
      previewContainer.classList.remove('hidden');
      uploadPlaceholder.classList.add('hidden');
    }
    
    modal.classList.add('hidden');
    log('그려진 평면도가 기본조사서 양식 사진으로 저장되었습니다.', 'success');
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initDrawingBoard();
  
  // Prevent accidental page reloads / navigation data loss
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome/Safari to display dialog
  });
});
