/**
 * Address search and address-field synchronization.
 */

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
