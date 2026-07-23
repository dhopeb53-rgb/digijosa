const { setJson, readJsonBody } = require('./_http');
const { maskPersonalInfo } = require('./_privacy');
const { usageSummary } = require('./_usage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return setJson(res, 405, { error: 'POST 요청만 지원합니다.' });
  if (!process.env.GEMINI_API_KEY) return setJson(res, 503, { error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });

  try {
    const body = await readJsonBody(req);
    const privacy = maskPersonalInfo(body.text || '');
    if (!privacy.maskedText.trim()) return setJson(res, 400, { error: '분석할 물건 설명이 없습니다.' });
    if (privacy.hasPersonalInfo) {
      return setJson(res, 400, {
        error: '서버 재검사에서 개인정보 가능성이 추가로 감지되었습니다. 원문 검토 화면에서 해당 내용을 제거해 주세요.',
        detectedTypes: [...new Set(privacy.detections.map((item) => item.type))]
      });
    }

    const allowedTypes = Array.isArray(body.allowedTypes) ? body.allowedTypes.slice(0, 100) : [];
    const allowedUnits = Array.isArray(body.allowedUnits) ? body.allowedUnits.slice(0, 100) : [];
    const model = process.env.GEMINI_STRUCTURE_MODEL || 'gemini-3.6-flash';
    const instructions = [
      '당신은 한국어 현장 물건조사 음성을 조사서 필드로 구조화한다.',
      '입력에 명시되지 않은 사실은 절대 추정하거나 생성하지 않는다. 빈 값은 빈 문자열 또는 null로 두고 needsReview에 확인 사유를 넣는다.',
      '여러 물건을 각각 분리한다. 경계가 애매하면 boundaryUncertain=true로 표시하고 needsReview에 설명한다.',
      '비고를 임의로 다음 물건에 붙이지 않는다. sourceExcerpt에는 해당 물건 판단에 사용한 짧은 원문 구절만 그대로 넣는다.',
      '숫자와 단위는 원문을 보존한다. 계산이나 단위 변환을 하지 않는다.',
      '반드시 {"items":[{"type":"","name":"","specs":"","qty":"","unit":"","remarks":"","needsReview":[],"boundaryUncertain":false,"sourceExcerpt":""}]} 형태의 JSON 객체를 반환한다.',
      `허용 물건 종류 후보: ${allowedTypes.join(', ') || '제한 없음'}`,
      `허용 단위 후보: ${allowedUnits.join(', ') || '제한 없음'}`,
      '개인정보 마스킹 표시는 결과의 어떤 필드에도 옮기지 않는다.'
    ].join('\n');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: privacy.maskedText }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini 물건 구조화 요청에 실패했습니다.');
    const outputText = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
    if (!outputText) throw new Error('Gemini가 구조화 결과를 반환하지 않았습니다.');
    const parsed = JSON.parse(outputText);
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 30).map((item) => ({
      type: String(item?.type || ''),
      name: String(item?.name || ''),
      specs: String(item?.specs || ''),
      qty: item?.qty == null ? '' : String(item.qty),
      unit: String(item?.unit || ''),
      remarks: String(item?.remarks || ''),
      needsReview: Array.isArray(item?.needsReview) ? item.needsReview.slice(0, 10).map(String) : [],
      boundaryUncertain: item?.boundaryUncertain === true,
      sourceExcerpt: String(item?.sourceExcerpt || '').slice(0, 300)
    })) : [];

    setJson(res, 200, {
      items,
      usage: usageSummary(model, data.usageMetadata || {})
    });
  } catch (error) {
    setJson(res, 502, { error: error.message || '물건 목록 생성 중 오류가 발생했습니다.' });
  }
};
