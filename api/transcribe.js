const { setJson, readRawBody } = require('./_http');

async function handler(req, res) {
  if (req.method !== 'POST') return setJson(res, 405, { error: 'POST 요청만 지원합니다.' });
  if (!process.env.GEMINI_API_KEY) return setJson(res, 503, { error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });

  try {
    const audio = await readRawBody(req, 12 * 1024 * 1024);
    if (!audio.length) return setJson(res, 400, { error: '녹음 파일이 비어 있습니다.' });
    const mimeType = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
    if (!mimeType.startsWith('audio/')) return setJson(res, 415, { error: '지원하지 않는 오디오 형식입니다.' });

    const supportedMimeTypes = new Set(['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/aiff']);
    if (!supportedMimeTypes.has(mimeType)) {
      return setJson(res, 415, { error: 'Gemini가 지원하지 않는 녹음 형식입니다. WAV 형식으로 다시 녹음해 주세요.' });
    }
    const model = process.env.GEMINI_AUDIO_MODEL || 'gemini-3.6-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: '다음 한국어 현장 물건조사 음성을 들리는 그대로 받아쓰세요. 설명이나 요약을 추가하지 마세요. 물건명, 구조, 규격, 숫자, m, ㎡, 동, 개, 주, 대 등의 단위를 특히 정확히 보존하세요.' },
            { inlineData: { mimeType, data: audio.toString('base64') } }
          ]
        }],
        generationConfig: { temperature: 0 }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini 음성 변환 요청에 실패했습니다.');
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
    if (!text) throw new Error('Gemini가 음성 원문을 반환하지 않았습니다.');

    const durationSeconds = Math.max(0, Number(req.headers['x-audio-duration']) || 0);
    setJson(res, 200, {
      text,
      usage: {
        provider: 'gemini',
        model,
        durationSeconds,
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        estimatedCostUsd: null
      }
    });
  } catch (error) {
    setJson(res, 502, { error: error.message || '음성 변환 중 오류가 발생했습니다.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
