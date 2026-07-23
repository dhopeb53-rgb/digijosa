const { setJson } = require('./_http');

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';

async function handler(req, res) {
  if (req.method !== 'POST') return setJson(res, 405, { error: 'POST 요청만 지원합니다.' });
  if (!process.env.GEMINI_API_KEY) return setJson(res, 503, { error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });

  try {
    const now = Date.now();
    const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 5 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        bidiGenerateContentSetup: {
          model: `models/${LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            temperature: 0,
            maxOutputTokens: 64
          },
          inputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
              silenceDurationMs: 500
            }
          },
          systemInstruction: {
            parts: [{
              text: '한국어 현장 물건조사 음성을 듣습니다. 음성으로 답하지 말고 입력 음성 전사만 처리하세요.'
            }]
          }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || '실시간 음성인식 토큰 발급에 실패했습니다.');
    if (!data.name) throw new Error('실시간 음성인식 토큰이 반환되지 않았습니다.');

    setJson(res, 200, {
      token: data.name,
      model: LIVE_MODEL,
      expiresInSeconds: 300
    });
  } catch (error) {
    setJson(res, 502, { error: error.message || '실시간 음성인식 연결 준비 중 오류가 발생했습니다.' });
  }
}

module.exports = handler;
