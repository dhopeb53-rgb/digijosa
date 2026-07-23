(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DigijosaPrivacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const rules = [
    {
      type: 'resident_id',
      label: '주민등록번호',
      regex: /\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b/g,
      replacement: '[주민등록번호 제외]'
    },
    {
      type: 'phone',
      label: '전화번호',
      regex: /\b(?:01[016789]|0(?:2|[3-6][1-5]))\s*[-.) ]?\s*\d{3,4}\s*[-. ]?\s*\d{4}\b/g,
      replacement: '[연락처 제외]'
    },
    {
      type: 'address',
      label: '주소',
      regex: /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s*[가-힣0-9·.-]+(?:시|군|구)\s*[가-힣0-9·.-]+(?:로|길|동|읍|면|리)\s*\d+(?:-\d+)?/g,
      replacement: '[주소 제외]'
    },
    {
      type: 'address',
      label: '주소',
      regex: /[가-힣0-9·.-]+(?:로|길)\s*\d+(?:-\d+)?(?:\s*\d+동\s*\d+호)?/g,
      replacement: '[주소 제외]'
    },
    {
      type: 'person_name',
      label: '성명',
      regex: /(?:소유자|성명|이름|명의자|임차인|대표자)\s*(?:은|는|이|가|:)?\s*[가-힣]{2,5}(?=\s|,|\.|이고|입니다|이다|$)/g,
      replacement: function (match) {
        const marker = match.match(/^(소유자|성명|이름|명의자|임차인|대표자)/);
        return `${marker ? marker[0] : '성명'} [성명 제외]`;
      }
    }
  ];

  function maskPersonalInfo(input) {
    let maskedText = String(input || '');
    const detections = [];
    rules.forEach((rule) => {
      maskedText = maskedText.replace(rule.regex, function (match) {
        detections.push({
          type: rule.type,
          label: rule.label,
          preview: match.length <= 4 ? '****' : `${match.slice(0, 2)}${'*'.repeat(Math.min(8, match.length - 2))}`
        });
        return typeof rule.replacement === 'function' ? rule.replacement(match) : rule.replacement;
      });
    });

    return {
      maskedText,
      detections,
      hasPersonalInfo: detections.length > 0,
      counts: detections.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  return { maskPersonalInfo };
});
