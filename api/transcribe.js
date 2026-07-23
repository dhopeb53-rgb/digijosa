const { setJson, readRawBody } = require('./_http');

async function handler(req, res) {
  if (req.method !== 'POST') return setJson(res, 405, { error: 'POST 요청만 지원합니다.' });
  if (!process.env.OPENAI_API_KEY) return setJson(res, 503, { error: '서버에 OPENAI_API_KEY가 설정되지 않았습니다.' });

  try {
    const audio = await readRawBody(req);
    if (!audio.length) return setJson(res, 400, { error: '녹음 파일이 비어 있습니다.' });
    const mimeType = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
    if (!mimeType.startsWith('audio/')) return setJson(res, 415, { error: '지원하지 않는 오디오 형식입니다.' });

    const form = new FormData();
    const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('wav') ? 'wav' : 'webm';
    form.append('file', new Blob([audio], { type: mimeType }), `recording.${extension}`);
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
    form.append('language', 'ko');
    form.append('prompt', '한국어 현장 물건조사 기록입니다. 물건명, 구조, 규격, 숫자, m, ㎡, 동, 개, 주, 대 등의 단위를 정확히 받아쓰세요.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || '음성 변환 서비스 요청에 실패했습니다.');

    const durationSeconds = Math.max(0, Number(req.headers['x-audio-duration']) || 0);
    const estimatedCostUsd = durationSeconds
      ? Number(((durationSeconds / 60) * Number(process.env.TRANSCRIBE_USD_PER_MINUTE || 0)).toFixed(6))
      : null;
    setJson(res, 200, {
      text: data.text || '',
      usage: {
        model: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
        durationSeconds,
        estimatedCostUsd
      }
    });
  } catch (error) {
    setJson(res, 502, { error: error.message || '음성 변환 중 오류가 발생했습니다.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
