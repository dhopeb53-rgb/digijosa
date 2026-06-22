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
    outOfDistrict: false // Out of District Status
  },
  items: [] // List of items/objects (Tab 2)
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
  "㎡", "주", "식", "대", "개", "m", "기타", "기", "두", "동", "t", "평방피트", 
  "조", "Kg", "세트", "톤", "상자", "차", "마리", "㎥", "군", "본", "정", "원/㎡", 
  "장", "수", "개소", "점", "ℓ", "매", "포", "평", "바렛", "파레트", "마대", 
  "소", "각", "cm", "단", "원/m", "폭", "근", "판", "척", "간", "가마", 
  "㏊", "D/M", "g", "mi", "yd", "관", "KN/m", "온스", "M/T", "홉", "인", 
  "%", "미국갤런", "in", "승", "ft", "원", "리", "원/a", "돈", "Kg/㎤", 
  "평방야드", "Kg/㎠", "㎤", "원/t", "a", "평방자", "입방야드", "B/K", "￡", 
  "단보", "정보", "acre", "입방인치", "입방피트", "Kg/m", "그레인", "해당없음"
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

// Format address with optional road name address, zip code, and detailed address for Excel sheet
function formatExcelAddress(jibun, road, zip, detail) {
  let mainJibun = jibun || '';
  if (detail) {
    mainJibun = mainJibun ? `${mainJibun} ${detail}` : detail;
  }
  
  let val = mainJibun;
  
  if (road || zip) {
    let mainRoad = road || '';
    if (detail && mainRoad) {
      mainRoad = `${mainRoad}, ${detail}`;
    }
    
    let sub = '';
    if (mainRoad && zip) {
      sub = `(도로명: ${mainRoad} / 우편번호: ${zip})`;
    } else if (mainRoad) {
      sub = `(도로명: ${mainRoad})`;
    } else if (zip) {
      sub = `(우편번호: ${zip})`;
    }
    if (val) {
      val += `\n${sub}`;
    } else {
      val = sub;
    }
  }
  return val;
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

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  log('SheetCraft AI 초기화 중...');
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
    { id: 'rep_name', key: 'repName' },
    { id: 'rep_jumin', key: 'repJumin' },
    { id: 'rep_addr', key: 'repAddr' },
    { id: 'rep_contact', key: 'repContact' },
    { id: 'biz_reg_no', key: 'bizRegNo' },
    { id: 'corp_reg_no', key: 'corpRegNo' },
    { id: 'special_notes', key: 'notes' },
    { id: 'district_name', key: 'district' },
    { id: 'biz_location', key: 'bizLocation' }
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
        }
        
        db.survey[inputInfo.key] = val;
        
        // Sync owner/location/district immediately to headers if photo tab is active
        if (inputInfo.key === 'owner' || inputInfo.key === 'location' || inputInfo.key === 'district') {
          if (inputInfo.key === 'location') {
            // Update item locations in Tab 2 if they match the old global location or are empty
            db.items.forEach(item => {
              if (!item.location || item.location === oldVal) {
                item.location = val;
                // Update the DOM input in Tab 2
                const cardEl = document.getElementById(`item-card-${item.id}`);
                if (cardEl) {
                  const locInput = cardEl.querySelector('.cell-location');
                  if (locInput) {
                    locInput.value = val;
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

  // Bind out_of_district checkbox
  const outOfDistrictEl = document.getElementById('out_of_district');
  if (outOfDistrictEl) {
    outOfDistrictEl.addEventListener('change', (e) => {
      db.survey.outOfDistrict = e.target.checked;
    });
  }

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

  // Tab 2: Add initial rows
  addTableDataRow();
  addTableDataRow();
  addTableDataRow();
  
  // Bind Action Buttons
  document.getElementById('tableAddTrigger').addEventListener('click', () => {
    addTableDataRow();
  });
  document.getElementById('btnDownloadZip').addEventListener('click', downloadZipArchive);
  document.getElementById('btnSendEmail').addEventListener('click', sendEmailWithZip);
  
  // Collapsible Bottom Panel (Bottom Sheet) Logic
  const actionsPanel = document.getElementById('actionsPanel');
  const panelHeader = document.getElementById('panelHeader');
  
  panelHeader.addEventListener('click', () => {
    actionsPanel.classList.toggle('expanded');
    const isExpanded = actionsPanel.classList.contains('expanded');
    log(`내보내기 패널 ${isExpanded ? '열림' : '닫힘'}`);
  });

  // Address Modal close event
  const btnCloseModal = document.getElementById('btnCloseAddressModal');
  const addressModal = document.getElementById('addressModal');
  if (btnCloseModal && addressModal) {
    btnCloseModal.addEventListener('click', () => {
      addressModal.classList.add('hidden');
    });
  }
});

// Kakao Address Search Integration
window.openAddressSearch = function(type) {
  if (typeof daum === 'undefined' || !daum.Postcode) {
    log('우편번호 서비스 라이브러리가 로드되지 않았습니다.', 'error');
    alert('우편번호 검색 서비스를 이용할 수 없습니다. 인터넷 연결을 확인해 주세요.');
    return;
  }
  
  const modal = document.getElementById('addressModal');
  const layer = document.getElementById('addressLayer');
  if (!modal || !layer) {
    log('주소 검색 모달 요소를 찾을 수 없습니다.', 'error');
    return;
  }
  
  // Show the modal overlay
  modal.classList.remove('hidden');
  
  new daum.Postcode({
    oncomplete: function(data) {
      try {
        if (!data) {
          log('주소 데이터가 빈 값입니다.', 'error');
          return;
        }
        log(`주소 데이터 수신 완료: ${data.address}`);
        
        // Determine Jibun Address (fallbacks)
        const jibunAddr = data.jibunAddress || data.autoJibunAddress || data.address;
        
        // Helper to safely update input and dispatch input event
        const safeUpdateInput = (id, val) => {
          const el = document.getElementById(id);
          if (el) {
            el.value = val || '';
            try {
              // Create and dispatch event safely (compatible with older webviews)
              let event;
              if (typeof Event === 'function') {
                try {
                  event = new Event('input', { bubbles: true });
                } catch (e) {
                  event = document.createEvent('Event');
                  event.initEvent('input', true, true);
                }
              } else {
                event = document.createEvent('Event');
                event.initEvent('input', true, true);
              }
              el.dispatchEvent(event);
            } catch (eventErr) {
              log(`이벤트 디스패치 실패 (${id}): ${eventErr.message}`, 'warning');
            }
          }
        };
        
        if (type === 'location') {
          // Direct State Writes (Redundancy 1)
          const oldLocation = db.survey.location;
          db.survey.location = jibunAddr;
          
          // DOM UI Updates & Event dispatching (Redundancy 2)
          safeUpdateInput('location_name', jibunAddr);
          
          // Tab 2 & Tab 3 Sync Redundancy (Redundancy 3)
          try {
            db.items.forEach(item => {
              if (!item.location || item.location === oldLocation || item.location === '') {
                item.location = jibunAddr;
                const cardEl = document.getElementById(`item-card-${item.id}`);
                if (cardEl) {
                  const locInput = cardEl.querySelector('.cell-location');
                  if (locInput) locInput.value = jibunAddr;
                }
              }
            });
            syncSurveyHeadersToPhotos();
          } catch (syncErr) {
            log(`상세 동기화 실패: ${syncErr.message}`, 'warning');
          }
          
        } else if (type === 'rep') {
          db.survey.repAddr = jibunAddr;
          safeUpdateInput('rep_addr', jibunAddr);
          
        } else if (type === 'biz') {
          db.survey.bizLocation = jibunAddr;
          safeUpdateInput('biz_location', jibunAddr);
        }
        
        log(`주소 자동 기입 완료 (${type}): ${jibunAddr}`);
      } catch (err) {
        log(`주소 기입 중 오류 발생: ${err.message}`, 'error');
        alert(`주소 기입 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        // Hide the modal after completion
        modal.classList.add('hidden');
      }
    },
    width: '100%',
    height: '100%',
    maxSuggestItems: 5
  }).embed(layer);
};

// Dynamic Row addition (Item Form Card) (Tab 2)
let rowIdCounter = 0;
function addTableDataRow() {
  rowIdCounter++;
  const container = document.getElementById('itemCardsList');
  const card = document.createElement('div');
  card.id = `item-card-${rowIdCounter}`;
  card.className = 'item-form-card item-row-fade-in';
  
  const currentId = rowIdCounter;
  const itemIndex = db.items.length + 1;
  
  // Bind inputs within the card
  const rowObj = {
    id: currentId,
    type: '기타지장물',
    name: '',
    specs: '',
    qty: 1,
    unit: '식',
    remarks: '',
    location: db.survey.location || '',
    hasLedger: false,
    isBusiness: false,
    isResidence: false,
    image: '', // Original upload Base64
    compositeImage: '', // Synthesized with board Base64
    overlayEnabled: true // Overlay enabled by default
  };
  
  db.items.push(rowObj);
  
  const typeOptionsHtml = SURVEY_ITEM_TYPES.map(t => 
    `<option value="${t}" ${t === '기타지장물' ? 'selected' : ''}>${t}</option>`
  ).join('') + `<option value="custom">직접 입력...</option>`;
  
  const unitOptionsHtml = SURVEY_ITEM_UNITS.map(u => 
    `<option value="${u}" ${u === '식' ? 'selected' : ''}>${u}</option>`
  ).join('') + `<option value="custom">직접 입력...</option>`;
  
  card.innerHTML = `
    <div class="item-card-header">
      <span class="item-num">물건 #${itemIndex}</span>
      <button type="button" class="btn-danger-icon btn-delete-item">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
    <div class="item-card-body">
      <!-- Line 1: 유형 | 명 | 수량 | 단위 -->
      <div class="item-card-row-1">
        <div class="form-group">
          <label>물건유형</label>
          <select class="cell-type">
            ${typeOptionsHtml}
          </select>
          <input type="text" class="cell-type-custom hidden" placeholder="유형 직접 입력">
        </div>
        <div class="form-group">
          <label>물건명</label>
          <input type="text" class="cell-name" placeholder="예: 컨테이너 창고">
        </div>
        <div class="form-group">
          <label>수량</label>
          <input type="text" class="cell-qty" inputmode="decimal" value="1" placeholder="수량" style="text-align: right;">
        </div>
        <div class="form-group">
          <label>단위</label>
          <select class="cell-unit">
            ${unitOptionsHtml}
          </select>
          <input type="text" class="cell-unit-custom hidden" placeholder="단위 직접 입력" style="width: 70px;">
        </div>
      </div>
      
      <!-- Line 2: 구조 및 규격 & 비고 (Parallel) -->
      <div class="item-card-row-2">
        <div class="form-group">
          <label>구조 및 규격</label>
          <textarea class="cell-specs" rows="1" placeholder="예: 조립식 판넬조 2.5x3m"></textarea>
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" class="cell-remarks" placeholder="비고 정보 입력">
        </div>
      </div>
      
      <!-- Line 3: 물건 소재지 & 체크박스 그룹 -->
      <div class="item-card-row-3">
        <div class="form-group">
          <label>물건 소재지</label>
          <input type="text" class="cell-location" value="${rowObj.location}" placeholder="예: OO동 OOO-OOO">
        </div>
        <div class="checkbox-grid-group">
          <div class="form-group">
            <label>건축물대장</label>
            <label class="checkbox-label-container">
              <input type="checkbox" class="cell-ledger">
              <span class="checkbox-text">대장 유</span>
            </label>
          </div>
          <div class="form-group">
            <label>영업장 여부</label>
            <label class="checkbox-label-container">
              <input type="checkbox" class="cell-business">
              <span class="checkbox-text">영업장</span>
            </label>
          </div>
          <div class="form-group">
            <label>거주 여부</label>
            <label class="checkbox-label-container">
              <input type="checkbox" class="cell-residence">
              <span class="checkbox-text">거주</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.appendChild(card);
  lucide.createIcons({ attrs: { class: 'lucide-icon-sm' } });
  
  // Set default location in input field (for fallback safety)
  const inputLocation = card.querySelector('.cell-location');
  if (inputLocation) {
    inputLocation.value = rowObj.location;
  }
  
  const selectType = card.querySelector('.cell-type');
  const inputTypeCustom = card.querySelector('.cell-type-custom');
  const selectUnit = card.querySelector('.cell-unit');
  const inputUnitCustom = card.querySelector('.cell-unit-custom');
  
  // Handle "Direct input" dropdown triggers
  selectType.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      inputTypeCustom.classList.remove('hidden');
      rowObj.type = '';
    } else {
      inputTypeCustom.classList.add('hidden');
      rowObj.type = e.target.value;
    }
    syncItemData(currentId);
  });
  
  inputTypeCustom.addEventListener('input', (e) => {
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
  
  card.querySelector('.cell-remarks').addEventListener('input', (e) => {
    rowObj.remarks = e.target.value;
    syncItemData(currentId);
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
  
  // Delete action
  card.querySelector('.btn-delete-item').addEventListener('click', () => {
    deleteTableRow(currentId, card);
  });
  
  updateRowNumbers();
  updatePhotoCards();
  log(`지장물 항목 추가 (ID: ${currentId})`);
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

// Re-index row numbers displayed in the HTML cards list
function updateRowNumbers() {
  const cards = document.querySelectorAll('#itemCardsList .item-form-card');
  cards.forEach((card, i) => {
    card.querySelector('.item-num').innerText = `물건 #${i + 1}`;
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
    
    // Sync to card-specs input box in Tab 3 if not customized
    const specsInput = cardElement.querySelector('.card-specs');
    if (specsInput && item.customSpecs === undefined) {
      specsInput.value = getDefaultItemDesc(item);
    }
    
    // Sync to card-location input box in Tab 3 directly (readonly)
    const locInput = cardElement.querySelector('.card-location');
    if (locInput) {
      locInput.value = item.location || db.survey.location || '';
    }
    
    // If there is an image loaded, re-draw overlay since text information changed
    if (item.image) {
      drawCompositeImage(item);
    }
  }
}

// Update survey header titles at the top of Photo Log
function syncSurveyHeadersToPhotos() {
  const ownerLabel = db.survey.owner || 'OOO';
  const locLabel = db.survey.location || 'OO동 OOO-OOO';
  log(`소재지/소유자/지구명 동기화 수행: 소유자: ${ownerLabel}, 주소: ${locLabel}`);
  
  // Trigger redraw of overlays for all cards since location info changed
  db.items.forEach(item => {
    // Dynamically update card input values
    const cardEl = document.querySelector(`.photo-card[data-item-id="${item.id}"]`);
    if (cardEl) {
      const locInput = cardEl.querySelector('.card-location');
      if (locInput) {
        locInput.value = item.location || db.survey.location || '';
      }
      
      const ownerInput = cardEl.querySelector('.card-owner');
      if (ownerInput && item.customOwner === undefined) {
        ownerInput.value = db.survey.owner;
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
          <div class="composite-preview-wrapper" id="preview-wrapper-${item.id}">
            ${item.compositeImage ? 
              `<img src="data:image/jpeg;base64,${item.compositeImage}" alt="합성 이미지 미리보기">` : 
              `<div class="no-photo-placeholder">
                <i data-lucide="camera-off"></i>
                <span>등록된 사진이 없습니다</span>
              </div>`
            }
          </div>
          <div class="image-upload-box" style="min-height: 48px; padding: 6px;">
            <input type="file" class="card-file-input" accept="image/*" data-item-id="${item.id}">
            <div class="upload-placeholder" style="flex-direction: row; gap: 6px; padding: 0;">
              <i data-lucide="camera" style="width: 18px; height: 18px;"></i>
              <span style="font-weight: bold; font-size: 13px;">사진 촬영 / 업로드</span>
            </div>
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
          
          <div class="form-group">
            <label>소재지 (물건내역 연동)</label>
            <input type="text" class="card-location" data-item-id="${item.id}" value="${item.location || db.survey.location || ''}" readonly style="background: rgba(255, 255, 255, 0.02); color: var(--text-secondary); cursor: not-allowed;" placeholder="소재지 입력">
          </div>
          
          <div class="form-group">
            <label>물건내용 (물건내역 연동)</label>
            <input type="text" class="card-specs" data-item-id="${item.id}" value="${item.customSpecs !== undefined ? item.customSpecs : getDefaultItemDesc(item)}" placeholder="물건내용 입력">
          </div>
          
          <div class="form-group">
            <label>소유자 (기본조사서 연동)</label>
            <input type="text" class="card-owner" data-item-id="${item.id}" value="${item.customOwner !== undefined ? item.customOwner : (db.survey.owner || '')}" placeholder="소유자 입력">
          </div>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
    
    // Bind Events to card inputs
    const fileInput = card.querySelector('.card-file-input');
    const overlayToggle = card.querySelector('.toggle-overlay');
    const locInput = card.querySelector('.card-location');
    const specsInput = card.querySelector('.card-specs');
    const ownerInput = card.querySelector('.card-owner');
    
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
    
    specsInput.addEventListener('input', (e) => {
      item.customSpecs = e.target.value;
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
      ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
      ctx.fillRect(distX, distY, tableWidth, tableHeight);
      
      // 2. Draw Table Borders and Grid Lines
      ctx.strokeStyle = '#38bdf8'; // Sky blue border
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
      const locationVal = item.location || db.survey.location || '';
      
      // Default description: name qty unit (specs)
      const defaultDesc = getDefaultItemDesc(item);
      const descVal = item.customSpecs !== undefined ? item.customSpecs : defaultDesc;
      
      const ownerVal = item.customOwner !== undefined ? item.customOwner : (db.survey.owner || '');
      const dateVal = db.survey.date || new Date().toISOString().split('T')[0];
      
      const values = [districtVal, locationVal, descVal, ownerVal, dateVal];
      const textPadding = 12;
      
      for (let i = 0; i < 5; i++) {
        const rowY = distY + (rowHeight * i) + (rowHeight / 2);
        
        // Draw Label (Teal highlighted)
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], distX + (labelsColWidth / 2), rowY);
        
        // Draw Value (White) with clipping to prevent overflow
        ctx.fillStyle = '#f8fafc';
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
    item.compositeImage = compositeBase64;
    
    // Update HTML preview wrapper immediately
    const previewWrapper = document.getElementById(`preview-wrapper-${item.id}`);
    if (previewWrapper) {
      previewWrapper.innerHTML = `<img src="data:image/jpeg;base64,${compositeBase64}" alt="합성 이미지 미리보기">`;
    }
  };
}

// Generate Excel Workbook buffer using ExcelJS
async function generateExcelBuffer() {
  log('엑셀 생성 고속 연동 가동...');
  
  if (typeof TEMPLATE_BASE64 === 'undefined') {
    throw new Error('템플릿 데이터가 준비되지 않았습니다.');
  }
  
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = base64ToArrayBuffer(TEMPLATE_BASE64);
  await workbook.xlsx.load(arrayBuffer);
  
  // --- 1. Fill Sheet: '조사서' ---
  const wsSurvey = workbook.getWorksheet('조사서');
  if (wsSurvey) {
    log('기본조사서 시트 기입 중...');
    
    // Unmerge target cells to prevent corruption when shifting rows
    const unmergeList = [
      'A6:B15', 'C14:E15', 'F14:P15', 'Q14:T15', 'U14:AD15',
      'A16:B20', 'C16:AD20', 'A21:B24', 'C21:AD24', 'A26:N29',
      'O26:AD27', 'O28:AD29'
    ];
    unmergeList.forEach(rng => {
      try {
        wsSurvey.unmergeCells(rng);
      } catch (e) {}
    });
    
    // Insert new row for '사업자등록증상 소재지' and '지구외 여부'
    wsSurvey.insertRow(14, [], 'i');
    wsSurvey.insertRow(15, [], 'i');
    
    // Copy style from shifted Row 16 and 17 to new Row 14 and 15
    const templateRow16 = wsSurvey.getRow(16);
    const templateRow17 = wsSurvey.getRow(17);
    const newRow14 = wsSurvey.getRow(14);
    const newRow15 = wsSurvey.getRow(15);
    
    newRow14.height = templateRow16.height;
    newRow15.height = templateRow17.height;
    
    for (let col = 1; col <= 30; col++) {
      newRow14.getCell(col).style = templateRow16.getCell(col).style;
      newRow15.getCell(col).style = templateRow17.getCell(col).style;
    }
    
    // Re-merge ranges with shifted coords
    const mergeList = [
      'A6:B17', // expanded
      'C14:E15', 'F14:P15', 'Q14:T15', 'U14:AD15', // new row
      'C16:E17', 'F16:P17', 'Q16:T17', 'U16:AD17', // shifted Row 14 (original)
      'A18:B22', 'C18:AD22', // shifted Row 16
      'A23:B26', 'C23:AD26', // shifted Row 21
      'A28:N31', 'O28:AD29', 'O30:AD31' // shifted Row 26+
    ];
    mergeList.forEach(rng => {
      try {
        wsSurvey.mergeCells(rng);
      } catch (e) {}
    });
    
    // Write new fields
    wsSurvey.getCell('C14').value = '사업자등록증상 소재지';
    const bizVal = db.survey.bizLocation || '';
    const cellF14 = wsSurvey.getCell('F14');
    cellF14.value = bizVal;
    cellF14.alignment = Object.assign({}, cellF14.alignment, { wrapText: true, vertical: 'middle' });
    
    wsSurvey.getCell('Q14').value = '지구외 여부';
    wsSurvey.getCell('U14').value = db.survey.outOfDistrict ? 'O' : '';
    wsSurvey.getCell('U14').alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Write original survey values to their shifted cells
    wsSurvey.getCell('F6').value = db.survey.company || '';
    wsSurvey.getCell('S6').value = db.survey.bizType || '';
    
    const locationVal = formatExcelAddress(db.survey.location, db.survey.locationRoad, db.survey.locationZip, db.survey.locationDetail);
    const cellF8 = wsSurvey.getCell('F8');
    cellF8.value = locationVal;
    cellF8.alignment = Object.assign({}, cellF8.alignment, { wrapText: true, vertical: 'middle' });
    
    wsSurvey.getCell('H10').value = db.survey.repName || '';
    wsSurvey.getCell('U10').value = db.survey.repJumin || '';
    
    const repVal = formatExcelAddress(db.survey.repAddr, db.survey.repRoad, db.survey.repZip, db.survey.repDetail);
    const cellH12 = wsSurvey.getCell('H12');
    cellH12.value = repVal;
    cellH12.alignment = Object.assign({}, cellH12.alignment, { wrapText: true, vertical: 'middle' });
    
    wsSurvey.getCell('U12').value = db.survey.repContact || '';
    
    // Shifted down by 2 rows
    wsSurvey.getCell('F16').value = db.survey.bizRegNo || '';
    wsSurvey.getCell('U16').value = db.survey.corpRegNo || '';
    wsSurvey.getCell('C23').value = db.survey.notes || '';
    
    // Date formatter shifted down by 2 rows (A26 -> A28)
    if (db.survey.date) {
      const dateStr = db.survey.date.trim();
      const match = dateStr.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})$/);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        wsSurvey.getCell('A28').value = `○ 조사일자 :   ${year}.   ${month}.   ${day}.   (사진촬영인)`;
      } else {
        wsSurvey.getCell('A28').value = `○ 조사일자 : ${dateStr}   (사진촬영인)`;
      }
    }
    
    // Signatures shifted down by 2 rows
    wsSurvey.getCell('O28').value = `○ 조사자 :                               ${db.survey.surveyor || ''}  (인)`;
    wsSurvey.getCell('O30').value = `○ 입회자 :                               ${db.survey.witness || ''}  (인)`;
    
    // Embed Panorama Photo shifted down by 2 rows (C16:AD20 -> C18:AD22)
    if (db.survey.photo) {
      const imgId = workbook.addImage({
        base64: db.survey.photo,
        extension: 'jpeg'
      });
      wsSurvey.addImage(imgId, {
        tl: { col: 2, row: 17 }, // Col C (2), Row 18 (17)
        br: { col: 30, row: 22 }  // Col AD (30), Row 22 (22)
      });
      log('기본조사서 전경/평면도 이미지 삽입 완료.');
    }
  }
  
  // --- 2. Fill Sheet: '물건내역(영업)' ---
  const wsItems = workbook.getWorksheet('물건내역(영업)');
  if (wsItems) {
    log('물건내역 시트 작성 및 동적 확장 처리 중...');
    
    // Set headers for extra columns
    const headerRow = wsItems.getRow(2);
    headerRow.getCell(8).value = '물건소재지';
    headerRow.getCell(9).value = '건축물대장 유무';
    headerRow.getCell(10).value = '영업장 여부';
    headerRow.getCell(11).value = '거주 여부';
    headerRow.getCell(8).style = headerRow.getCell(7).style;
    headerRow.getCell(9).style = headerRow.getCell(7).style;
    headerRow.getCell(10).style = headerRow.getCell(7).style;
    headerRow.getCell(11).style = headerRow.getCell(7).style;
    
    // Set column widths
    wsItems.getColumn(8).width = 25;
    wsItems.getColumn(9).width = 15;
    wsItems.getColumn(10).width = 15;
    wsItems.getColumn(11).width = 15;
    
    // Write items to sheet. Insert rows dynamically if it exceeds 4 default slots.
    db.items.forEach((item, index) => {
      const rowNum = EXCEL_ITEM_START_ROW + index;
      
      // If we exceed default pre-filled rows, insert row in ExcelJS
      if (index >= EXCEL_DEFAULT_ITEMS_COUNT) {
        wsItems.insertRow(rowNum, [], 'i');
      }
      
      const row = wsItems.getRow(rowNum);
      const templateRow = wsItems.getRow(EXCEL_ITEM_START_ROW);
      
      // Copy styling for all columns 1 to 11
      for (let col = 1; col <= 11; col++) {
        if (index >= EXCEL_DEFAULT_ITEMS_COUNT || col > 7) {
          row.getCell(col).style = templateRow.getCell(col > 7 ? 7 : col).style;
        }
      }
      
      row.getCell(1).value = index + 1;
      row.getCell(2).value = item.type || '';
      row.getCell(3).value = item.name || '';
      row.getCell(4).value = item.specs || '';
      const qtyVal = item.qty ? item.qty.toString().trim() : '';
      const qtyNum = Number(qtyVal);
      row.getCell(5).value = (qtyVal === '' ? '' : (isNaN(qtyNum) ? qtyVal : qtyNum));
      row.getCell(6).value = item.unit || '';
      row.getCell(7).value = item.remarks || '';
      row.getCell(8).value = item.location || '';
      row.getCell(9).value = item.hasLedger ? 'O' : '';
      row.getCell(10).value = item.isBusiness ? '영업장' : '';
      row.getCell(11).value = item.isResidence ? '거주' : '';
      
      // Set alignment and border height
      row.height = 24;
    });
    
    // Delete unused default placeholder rows if the item count is less than default (4)
    if (db.items.length < EXCEL_DEFAULT_ITEMS_COUNT) {
      const start = EXCEL_ITEM_START_ROW + db.items.length;
      const count = EXCEL_DEFAULT_ITEMS_COUNT - db.items.length;
      wsItems.spliceRows(start, count);
    }
  }
  
  // --- 3. Fill Sheet: ' 사진대지' (Note the space in name) ---
  const wsPhotos = workbook.getWorksheet(' 사진대지') || workbook.getWorksheet('사진대지');
  if (wsPhotos) {
    log('사진대지 격자 양식 매칭 및 A4 페이지 단위 복제 중...');
    
    // Top headers
    wsPhotos.getCell('D3').value = db.survey.owner || '';
    wsPhotos.getCell('O3').value = db.survey.location || '';
    
    // Dynamic Sheet Expansion for A4 page copies
    const totalPhotos = db.items.length;
    if (totalPhotos > 12) {
      const extraPhotos = totalPhotos - 12;
      const extraPagesNeeded = Math.ceil(extraPhotos / 6);
      log(`사진 개수(${totalPhotos}장)가 12장 한도를 초과하여 ${extraPagesNeeded}개의 A4 페이지를 추가 생성합니다.`);
      
      // A4 page template height: rows 37 to 73 (Page 2) is exactly 37 rows
      const templateStartRow = 37;
      const templateEndRow = 73;
      const pageSize = 37;
      
      for (let p = 0; p < extraPagesNeeded; p++) {
        const destOffset = 74 + (p * pageSize);
        
        // Loop over the source rows of Page 2 template
        for (let r = templateStartRow; r <= templateEndRow; r++) {
          const srcRowNum = r;
          const destRowNum = destOffset + (r - templateStartRow);
          
          const srcRow = wsPhotos.getRow(srcRowNum);
          const destRow = wsPhotos.getRow(destRowNum);
          
          // Copy row height
          destRow.height = srcRow.height;
          
          // Copy cells
          for (let col = 1; col <= 22; col++) { // A to V
            const srcCell = srcRow.getCell(col);
            const destCell = destRow.getCell(col);
            
            destCell.value = srcCell.value;
            destCell.style = srcCell.style;
          }
        }
        
        // Copy merged cells configuration for this page
        // Page 2 merged ranges fall within row 37 to 73. Shift them down by offset.
        const sourceMergedRanges = wsPhotos.mergedCells; // List of merged coordinate strings
        const pageOffset = 37 + (p * pageSize);
        
        // We will collect merges to prevent mutating list during iteration
        const newMerges = [];
        wsPhotos.mergedCells.forEach(coord => {
          // Parse coordinates like A37:V38
          const parts = coord.split(':');
          if (parts.length === 2) {
            const startCell = wsPhotos.getCell(parts[0]);
            const endCell = wsPhotos.getCell(parts[1]);
            
            // Check if this merge is strictly part of the Page 2 template (rows 37-73)
            if (startCell.row >= templateStartRow && endCell.row <= templateEndRow) {
              const newStartRow = startCell.row + pageOffset;
              const newEndRow = endCell.row + pageOffset;
              
              const newStartCol = openpyxlColLetter(startCell.col);
              const newEndCol = openpyxlColLetter(endCell.col);
              
              newMerges.push(`${newStartCol}${newStartRow}:${newEndCol}${newEndRow}`);
            }
          }
        });
        
        // Apply new merged cells
        newMerges.forEach(coord => {
          try {
            wsPhotos.mergeCells(coord);
          } catch(e) {}
        });
      }
    }
    
    // Embed photo list
    db.items.forEach((item, index) => {
      const pageIndex = Math.floor(index / 6);
      const slotIndex = index % 6;
      
      // Calculate row numbers based on formula: (page * 37) + 5 + (row_group * 11)
      const photoRowStart = (pageIndex * 37) + 5 + (Math.floor(slotIndex / 2) * 11);
      const descRow = (pageIndex * 37) + 14 + (Math.floor(slotIndex / 2) * 11);
      
      let photoColStart, photoColEnd, descColStart, descColEnd;
      
      if (slotIndex % 2 === 0) { // Left Column
        photoColStart = 2; // B
        photoColEnd = 10;  // J
        descColStart = 3;  // C
        descColEnd = 11;   // K
      } else { // Right Column
        photoColStart = 13; // M
        photoColEnd = 21;   // U
        descColStart = 14;  // N
        descColEnd = 22;    // V
      }
      
      // Write photo description label (utilizing customSpecs if customized)
      const defaultDesc = getDefaultItemDesc(item);
      const itemDesc = item.customSpecs !== undefined ? item.customSpecs : defaultDesc;
      wsPhotos.getCell(descRow, descColStart).value = itemDesc;
      
      // Embed composite photo
      const activePhoto = item.compositeImage || item.image;
      if (activePhoto) {
        const imgId = workbook.addImage({
          base64: activePhoto,
          extension: 'jpeg'
        });
        
        wsPhotos.addImage(imgId, {
          tl: { col: photoColStart - 1, row: photoRowStart - 1 },
          br: { col: photoColEnd, row: photoRowStart - 1 + 8 } // height is 8 rows
        });
        log(`사진 #${index + 1} 엑셀 시트 결합 성공 (Row: ${photoRowStart})`);
      }
    });
  }
  
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

// ZIP Compression and Download trigger
async function downloadZipArchive() {
  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = '20%';
  
  log('ZIP 압축 패키징 준비 중...');
  try {
    const excelBuffer = await generateExcelBuffer();
    progressBar.style.width = '60%';
    
    const zip = new JSZip();
    
    // Add Excel document
    const ownerName = db.survey.owner || '공통';
    const dateStr = db.survey.date ? db.survey.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filenameBase = `조사보고서_${ownerName}_${dateStr}`;
    
    zip.file(`${filenameBase}.xlsx`, excelBuffer);
    
    // Add photo files
    const photosFolder = zip.folder("현장사진");
    
    // Add site panorama/floor plan if exists
    if (db.survey.photo) {
      const pData = base64ToArrayBuffer(db.survey.photo);
      photosFolder.file("00_현장전경_평면도.jpg", pData);
    }
    
    // Add photo log photos
    db.items.forEach((item, index) => {
      const activePhoto = item.compositeImage || item.image;
      if (activePhoto) {
        const photoData = base64ToArrayBuffer(activePhoto);
        const nameClean = (item.name || '미입력').replace(/[\/\\?%*:|"<>. ]/g, '_');
        photosFolder.file(`사진_${index + 1}_${nameClean}.jpg`, photoData);
      }
    });
    
    progressBar.style.width = '80%';
    log('ZIP 압축 파일 빌드 시작...');
    
    const content = await zip.generateAsync({ type: "blob" });
    
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
    const excelBuffer = await generateExcelBuffer();
    progressBar.style.width = '70%';
    
    // Construct base64 payload of generated files
    const zip = new JSZip();
    const ownerName = db.survey.owner || '공통';
    const dateStr = db.survey.date ? db.survey.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filenameBase = `조사보고서_${ownerName}_${dateStr}`;
    
    zip.file(`${filenameBase}.xlsx`, excelBuffer);
    
    db.items.forEach((item, index) => {
      const activePhoto = item.compositeImage || item.image;
      if (activePhoto) {
        const photoData = base64ToArrayBuffer(activePhoto);
        const nameClean = (item.name || '미입력').replace(/[\/\\?%*:|"<>. ]/g, '_');
        zip.file(`현장사진/사진_${index + 1}_${nameClean}.jpg`, photoData);
      }
    });
    
    const zipBlob = await zip.generateAsync({ type: "base64" });
    progressBar.style.width = '90%';
    
    // --- Google Apps Script / Email Webhook Integration ---
    // If the user configures a webhook URL, we can POST the base64 string to it.
    // Otherwise, we guide them on how to link their Google Apps Script for FREE.
    const googleScriptUrl = localStorage.getItem('google_apps_script_url') || '';
    
    if (googleScriptUrl) {
      // Real API transmission
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
    } else {
      // Demo Mode & Guidance
      progressBar.style.width = '100%';
      log('메일 발송 준비 완료 (서버리스 전송 가이드 모드)', 'warning');
      
      const setupScript = confirm(
        `[이메일 전송 연동 안내]\n\n` +
        `본 앱은 서버가 없는 클라이언트 앱이므로, 개인 Gmail 계정으로 이메일을 무료로 자동 발송하기 위해 간단한 '구글 앱스 스크립트' 설정이 필요합니다.\n\n` +
        `설정 주소 등록 창을 띄울까요? (확인을 누르시면 설정 방법 안내 및 주소 입력창이 뜹니다.)`
      );
      
      if (setupScript) {
        const url = prompt(
          `설정 순서:\n` +
          `1. 구글 드라이브 -> Google Apps Script 생성\n` +
          `2. GmailApp.sendEmail 코드 붙여넣기 및 배포 (안내 파일 참조)\n` +
          `3. 생성된 '웹 앱 URL' 주소를 아래에 입력:\n`,
          googleScriptUrl
        );
        
        if (url) {
          localStorage.setItem('google_apps_script_url', url.trim());
          log('구글 앱스 스크립트 웹앱 주소가 저장되었습니다. 다시 발송 버튼을 누르시면 실제 발송됩니다.', 'success');
        }
      }
    }
    
    setTimeout(() => {
      progressBar.style.width = '0%';
    }, 2000);
    
  } catch (err) {
    log(`메일 발송 실패: ${err.message}`, 'error');
    progressBar.style.width = '0%';
    alert(`메일 전송 실패: ${err.message}`);
  }
}
