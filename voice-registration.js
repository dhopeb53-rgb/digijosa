/**
 * Optional AI voice item registration.
 * The manual item-entry path remains untouched and fully functional.
 */
(function () {
  'use strict';

  const MAX_SECONDS = 60;
  const TRANSCRIPTION_SAMPLE_RATE = 16000;
  const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
  const LIVE_SOCKET_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
  const DB_NAME = 'digijosa-voice-queue';
  const STORE_NAME = 'recordings';
  const API_BASE = (window.DIGIJOSA_API_BASE || '').replace(/\/$/, '');
  const configuredTypes = () => typeof SURVEY_ITEM_TYPES !== 'undefined' ? SURVEY_ITEM_TYPES : [];
  const configuredUnits = () => typeof SURVEY_ITEM_UNITS !== 'undefined' ? SURVEY_ITEM_UNITS : [];
  const state = {
    stream: null,
    audioProcessor: null,
    audioSource: null,
    pcmChunks: [],
    sampleRate: 44100,
    isRecording: false,
    timerId: null,
    meterFrame: null,
    audioContext: null,
    startedAt: 0,
    durationSeconds: 0,
    currentBlob: null,
    drafts: [],
    transcript: '',
    liveSocket: null,
    liveReady: false,
    liveFailed: false,
    liveTranscript: '',
    lastLiveTranscriptAt: 0,
    liveDoneResolve: null
  };

  const $ = (id) => document.getElementById(id);
  const modal = $('voiceItemModal');
  if (!modal) return;

  function setStep(step) {
    document.querySelectorAll('[data-voice-step]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.voiceStep !== step);
    });
    document.querySelectorAll('[data-voice-step-indicator]').forEach((el) => {
      const order = ['record', 'transcript', 'review'];
      el.classList.toggle('active', order.indexOf(el.dataset.voiceStepIndicator) <= order.indexOf(step));
    });
    hideError();
  }

  function setProcessing(active, text) {
    $('voiceProcessing').classList.toggle('hidden', !active);
    if (text) $('voiceProcessingText').textContent = text;
  }

  function showError(message) {
    $('voiceError').textContent = message;
    $('voiceError').classList.remove('hidden');
  }

  function hideError() {
    $('voiceError').classList.add('hidden');
  }

  function openModal() {
    resetVoiceSession();
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    setStep('record');
    refreshQueueCount();
    lucide.createIcons();
  }

  function closeModal() {
    stopMedia();
    resetVoiceSession();
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function stopMedia() {
    clearInterval(state.timerId);
    cancelAnimationFrame(state.meterFrame);
    state.isRecording = false;
    if (state.audioProcessor) {
      state.audioProcessor.onaudioprocess = null;
      state.audioProcessor.disconnect();
    }
    if (state.audioSource) state.audioSource.disconnect();
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    if (state.audioContext) state.audioContext.close().catch(() => {});
    state.stream = null;
    state.audioProcessor = null;
    state.audioSource = null;
    state.audioContext = null;
  }

  function closeLiveSocket() {
    state.liveReady = false;
    state.liveDoneResolve?.();
    state.liveDoneResolve = null;
    if (state.liveSocket) {
      state.liveSocket.onclose = null;
      state.liveSocket.onerror = null;
      if (state.liveSocket.readyState < WebSocket.CLOSING) state.liveSocket.close();
    }
    state.liveSocket = null;
  }

  function formatTimer(seconds) {
    return `00:${String(Math.min(60, seconds)).padStart(2, '0')} / 01:00`;
  }

  async function startRecording() {
    hideError();
    if (!navigator.mediaDevices || !(window.AudioContext || window.webkitAudioContext)) {
      showError('이 브라우저에서는 음성 녹음을 지원하지 않습니다. 기존 직접 등록을 이용해 주세요.');
      return;
    }
    try {
      $('voiceRecordingStatus').textContent = '실시간 음성인식 연결 중...';
      $('btnStartVoiceRecording').disabled = true;
      try {
        await connectLiveTranscription();
      } catch (liveError) {
        state.liveFailed = true;
        closeLiveSocket();
        $('voiceVolumeHelp').textContent = '실시간 연결이 어려워 기존 안전 모드로 녹음합니다.';
        logVoiceMetric('live_connection_failure', { reason: liveError.message });
      }
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await state.audioContext.resume();
      state.sampleRate = state.audioContext.sampleRate;
      state.pcmChunks = [];
      state.audioSource = state.audioContext.createMediaStreamSource(state.stream);
      const analyser = state.audioContext.createAnalyser();
      analyser.fftSize = 256;
      state.audioSource.connect(analyser);
      state.audioProcessor = state.audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = state.audioContext.createGain();
      silentGain.gain.value = 0;
      state.audioSource.connect(state.audioProcessor);
      state.audioProcessor.connect(silentGain);
      silentGain.connect(state.audioContext.destination);
      state.audioProcessor.onaudioprocess = (event) => {
        if (!state.isRecording) return;
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        state.pcmChunks.push(chunk);
        if (state.liveReady) sendLiveAudioChunk(chunk, state.sampleRate);
      };
      state.startedAt = Date.now();
      state.durationSeconds = 0;
      state.isRecording = true;
      $('btnStartVoiceRecording').classList.add('hidden');
      $('btnStopVoiceRecording').classList.remove('hidden');
      $('voiceRecordingStatus').textContent = '● 녹음 중';
      $('voiceRecordingStatus').classList.add('is-recording');
      $('voiceLiveTranscript').classList.remove('hidden');
      $('voiceLiveTranscript').textContent = state.liveReady
        ? '말씀하시면 여기에 실시간으로 표시됩니다.'
        : '녹음 완료 후 텍스트로 변환합니다.';
      beginTimer();
      beginMeter(analyser);
    } catch (error) {
      closeLiveSocket();
      showError(error.name === 'NotAllowedError'
        ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용하거나 직접 등록을 이용해 주세요.'
        : `마이크를 시작하지 못했습니다: ${error.message}`);
    } finally {
      $('btnStartVoiceRecording').disabled = false;
    }
  }

  async function connectLiveTranscription() {
    if (!navigator.onLine || typeof WebSocket === 'undefined') throw new Error('실시간 연결을 지원하지 않는 환경입니다.');
    state.liveFailed = false;
    state.liveTranscript = '';
    const tokenData = await apiFetch('/api/live-token', { method: 'POST' });
    if (!tokenData.token) throw new Error('실시간 음성인식 토큰을 받지 못했습니다.');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        closeLiveSocket();
        reject(new Error('실시간 음성인식 연결 시간이 초과되었습니다.'));
      }, 7000);
      const socket = new WebSocket(`${LIVE_SOCKET_URL}?access_token=${encodeURIComponent(tokenData.token)}`);
      state.liveSocket = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({
          setup: {
            model: `models/${tokenData.model || LIVE_MODEL}`,
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
        }));
      };
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        if (message.setupComplete) {
          clearTimeout(timeout);
          state.liveReady = true;
          resolve();
          return;
        }
        const inputText = message.serverContent?.inputTranscription?.text;
        if (inputText) appendLiveTranscript(inputText);
        if (message.error) {
          state.liveFailed = true;
          state.liveDoneResolve?.();
        }
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        state.liveFailed = true;
        if (!state.liveReady) reject(new Error('Gemini Live 연결에 실패했습니다.'));
        state.liveDoneResolve?.();
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        if (state.isRecording) state.liveFailed = true;
        state.liveReady = false;
        state.liveDoneResolve?.();
      };
    });
  }

  function appendLiveTranscript(text) {
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    state.liveTranscript = `${state.liveTranscript}${state.liveTranscript && !/[\s]$/.test(state.liveTranscript) ? ' ' : ''}${cleaned}`.trim();
    state.lastLiveTranscriptAt = Date.now();
    $('voiceLiveTranscript').textContent = state.liveTranscript;
  }

  function sendLiveAudioChunk(chunk, inputSampleRate) {
    if (!state.liveSocket || state.liveSocket.readyState !== WebSocket.OPEN) return;
    const samples = downsamplePcm([chunk], inputSampleRate, TRANSCRIPTION_SAMPLE_RATE)[0];
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    state.liveSocket.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: btoa(binary),
          mimeType: `audio/pcm;rate=${TRANSCRIPTION_SAMPLE_RATE}`
        }
      }
    }));
  }

  function beginTimer() {
    state.timerId = setInterval(() => {
      state.durationSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
      $('voiceTimer').textContent = formatTimer(state.durationSeconds);
      if (state.durationSeconds >= MAX_SECONDS) stopRecording();
    }, 250);
  }

  function beginMeter(analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      const percent = Math.min(100, Math.round(average * 1.5));
      $('voiceMeterFill').style.width = `${Math.max(2, percent)}%`;
      $('voiceVolumeHelp').textContent = percent < 12
        ? '목소리가 작습니다. 기기에 조금 더 가까이 말씀해 주세요.'
        : '음성이 정상적으로 입력되고 있습니다.';
      $('voiceVolumeHelp').classList.toggle('is-warning', percent < 12);
      state.meterFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  async function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    clearInterval(state.timerId);
    cancelAnimationFrame(state.meterFrame);
    $('btnStopVoiceRecording').classList.add('hidden');
    $('voiceRecordingStatus').textContent = '녹음 처리 중';
    state.currentBlob = encodeWav(
      downsamplePcm(state.pcmChunks, state.sampleRate, TRANSCRIPTION_SAMPLE_RATE),
      TRANSCRIPTION_SAMPLE_RATE
    );
    const hadLiveConnection = state.liveReady;
    if (hadLiveConnection && state.liveSocket?.readyState === WebSocket.OPEN) {
      state.liveSocket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
    stopMedia();
    if (state.currentBlob.size < 1000) {
      showError('녹음된 음성이 너무 짧습니다. 다시 녹음해 주세요.');
      resetRecorderUi();
      return;
    }
    if (hadLiveConnection) {
      $('voiceRecordingStatus').textContent = '실시간 원문 마무리 중';
      await waitForLiveTranscript();
    }
    const liveText = state.liveTranscript.trim();
    closeLiveSocket();
    if (liveText && !state.liveFailed) {
      state.transcript = liveText;
      $('voiceTranscript').value = liveText;
      runPrivacyPreview();
      setStep('transcript');
      logVoiceMetric('live_transcription_success', {
        durationSeconds: state.durationSeconds,
        characterCount: liveText.length
      });
      return;
    }
    await transcribeCurrentBlob();
  }

  function waitForLiveTranscript() {
    setProcessing(true, '실시간 인식 결과를 마무리하고 있습니다...');
    return new Promise((resolve) => {
      let settled = false;
      const startedAt = Date.now();
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(checkTimer);
        state.liveDoneResolve = null;
        setProcessing(false);
        resolve();
      };
      state.liveDoneResolve = finish;
      const checkTimer = setInterval(() => {
        const hasSettledText = state.liveTranscript
          && Date.now() - state.lastLiveTranscriptAt >= 600
          && Date.now() - startedAt >= 300;
        if (hasSettledText || Date.now() - startedAt >= 2500) finish();
      }, 100);
    });
  }

  function downsamplePcm(chunks, inputSampleRate, outputSampleRate) {
    const inputLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const input = new Float32Array(inputLength);
    let inputOffset = 0;
    chunks.forEach((chunk) => {
      input.set(chunk, inputOffset);
      inputOffset += chunk.length;
    });
    if (inputSampleRate <= outputSampleRate) return [input];

    const ratio = inputSampleRate / outputSampleRate;
    const output = new Float32Array(Math.floor(input.length / ratio));
    for (let i = 0; i < output.length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      output[i] = sum / Math.max(1, end - start);
    }
    return [output];
  }

  function encodeWav(chunks, sampleRate) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const writeAscii = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, length * 2, true);
    let offset = 44;
    chunks.forEach((chunk) => {
      for (let i = 0; i < chunk.length; i++, offset += 2) {
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      }
    });
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function resetRecorderUi() {
    $('btnStartVoiceRecording').classList.remove('hidden');
    $('btnStopVoiceRecording').classList.add('hidden');
    $('voiceRecordingStatus').textContent = '녹음 준비';
    $('voiceRecordingStatus').classList.remove('is-recording');
    $('voiceMeterFill').style.width = '0';
    $('voiceTimer').textContent = '00:00 / 01:00';
    $('voiceLiveTranscript').classList.add('hidden');
    $('voiceLiveTranscript').textContent = '';
  }

  function resetVoiceSession() {
    stopMedia();
    closeLiveSocket();
    state.pcmChunks = [];
    state.durationSeconds = 0;
    state.currentBlob = null;
    state.drafts = [];
    state.transcript = '';
    state.liveFailed = false;
    state.liveTranscript = '';
    state.lastLiveTranscriptAt = 0;
    $('voiceTranscript').value = '';
    $('voiceItemDrafts').innerHTML = '';
    $('privacyDetectionResult').classList.add('hidden');
    $('privacyProceedRow').classList.add('hidden');
    $('privacyProceedConsent').checked = false;
    setProcessing(false);
    hideError();
    resetRecorderUi();
  }

  async function apiFetch(path, options) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
    return data;
  }

  async function transcribeCurrentBlob(fromQueueId) {
    setProcessing(true, '음성을 텍스트로 변환하고 있습니다...');
    hideError();
    try {
      if (!navigator.onLine) throw new Error('현재 오프라인 상태입니다.');
      const data = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': state.currentBlob.type || 'audio/webm',
          'X-Audio-Duration': String(state.durationSeconds || 0)
        },
        body: state.currentBlob
      });
      state.transcript = data.text || '';
      $('voiceTranscript').value = state.transcript;
      runPrivacyPreview();
      if (fromQueueId) await deleteQueuedRecording(fromQueueId);
      setStep('transcript');
      logVoiceMetric('transcription_success', {
        durationSeconds: state.durationSeconds,
        estimatedCostUsd: data.usage?.estimatedCostUsd || null
      });
    } catch (error) {
      let queued = fromQueueId || null;
      if (!queued) {
        try {
          queued = await queueRecording(state.currentBlob, state.durationSeconds, error.message);
        } catch (_) {
          // IndexedDB can be unavailable in private browsing or restricted environments.
        }
      }
      showError(queued
        ? `${error.message} 녹음은 이 기기에 임시 보관되었습니다. 네트워크 연결 후 재전송할 수 있습니다.`
        : `${error.message} 기기 저장소를 사용할 수 없어 녹음을 보관하지 못했습니다. 원문을 직접 입력하거나 다시 녹음해 주세요.`);
      logVoiceMetric(queued ? 'transcription_queued' : 'transcription_failure', { reason: error.message, queueId: queued });
      resetRecorderUi();
      refreshQueueCount();
    } finally {
      setProcessing(false);
    }
  }

  function runPrivacyPreview() {
    const result = window.DigijosaPrivacy.maskPersonalInfo($('voiceTranscript').value);
    const box = $('privacyDetectionResult');
    const consentRow = $('privacyProceedRow');
    if (!result.hasPersonalInfo) {
      box.classList.add('hidden');
      consentRow.classList.add('hidden');
      $('privacyProceedConsent').checked = false;
      return result;
    }
    const labels = [...new Set(result.detections.map((item) => item.label))].join(', ');
    box.innerHTML = `<strong>개인정보로 보이는 내용이 감지되어 제외됩니다.</strong>
      <p>감지 항목: ${escapeHtml(labels)}</p>
      <details><summary>AI에 전송될 마스킹 원문 보기</summary><pre>${escapeHtml(result.maskedText)}</pre></details>`;
    box.classList.remove('hidden');
    consentRow.classList.remove('hidden');
    return result;
  }

  async function structureItems() {
    hideError();
    const originalText = $('voiceTranscript').value.trim();
    if (!originalText) {
      showError('인식 원문을 입력하거나 다시 녹음해 주세요.');
      return;
    }
    const privacy = runPrivacyPreview();
    if (privacy.hasPersonalInfo && !$('privacyProceedConsent').checked) {
      showError('마스킹된 원문을 확인했다는 항목에 체크해 주세요.');
      return;
    }
    if (privacy.maskedText.replace(/\[[^\]]+ 제외\]/g, '').trim().length < 4) {
      showError('개인정보를 제외하면 분석할 물건 설명이 충분하지 않습니다. 직접 등록을 이용해 주세요.');
      return;
    }

    setProcessing(true, '물건별 내용을 분류하고 있습니다...');
    try {
      const data = await apiFetch('/api/structure-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: privacy.maskedText,
          allowedTypes: configuredTypes(),
          allowedUnits: configuredUnits()
        })
      });
      state.drafts = (data.items || []).map(normalizeDraft);
      if (!state.drafts.length) throw new Error('등록 가능한 물건을 찾지 못했습니다.');
      renderDrafts();
      setStep('review');
      logVoiceMetric('structure_success', {
        itemCount: state.drafts.length,
        personalInfoMasked: privacy.detections.length,
        inputTokens: data.usage?.inputTokens || 0,
        outputTokens: data.usage?.outputTokens || 0,
        estimatedCostUsd: data.usage?.estimatedCostUsd || null
      });
    } catch (error) {
      showError(error.message);
      logVoiceMetric('structure_failure', { reason: error.message });
    } finally {
      setProcessing(false);
    }
  }

  function normalizeDraft(item) {
    return {
      selected: true,
      type: item.type || '기타지장물',
      name: item.name || '',
      specs: item.specs || '',
      qty: item.qty ?? '',
      unit: item.unit || '',
      remarks: item.remarks || '',
      needsReview: Array.isArray(item.needsReview) ? item.needsReview : [],
      boundaryUncertain: !!item.boundaryUncertain,
      sourceExcerpt: item.sourceExcerpt || ''
    };
  }

  function renderDrafts() {
    const container = $('voiceItemDrafts');
    $('voiceReviewSummary').textContent = `AI가 ${state.drafts.length}개의 물건 초안을 만들었습니다.`;
    container.innerHTML = state.drafts.map((item, index) => `
      <article class="voice-draft-card ${item.needsReview.length || item.boundaryUncertain ? 'needs-review' : ''}" data-draft-index="${index}">
        <div class="voice-draft-header">
          <label><input type="checkbox" class="draft-selected" ${item.selected ? 'checked' : ''}> 물건 ${index + 1}</label>
          <span class="draft-status">${item.boundaryUncertain ? '경계 불확실' : item.needsReview.length ? '확인 필요' : '초안'}</span>
        </div>
        ${item.boundaryUncertain ? '<p class="draft-warning">앞뒤 물건 설명의 경계가 불명확할 수 있습니다. 원문과 비교해 주세요.</p>' : ''}
        <div class="voice-draft-grid">
          <label>종류<input class="draft-type" value="${escapeHtml(item.type)}"></label>
          <label>물건명<input class="draft-name" value="${escapeHtml(item.name)}"></label>
          <label class="span-2">구조·규격<input class="draft-specs numeric-critical" value="${escapeHtml(item.specs)}"></label>
          <label>수량<input class="draft-qty numeric-critical" inputmode="decimal" value="${escapeHtml(item.qty)}"></label>
          <label>단위<input class="draft-unit numeric-critical" value="${escapeHtml(item.unit)}"></label>
          <label class="span-2">비고<input class="draft-remarks" value="${escapeHtml(item.remarks)}"></label>
        </div>
        ${item.sourceExcerpt ? `<p class="draft-source">원문 근거: “${escapeHtml(item.sourceExcerpt)}”</p>` : ''}
        ${item.needsReview.length ? `<ul class="draft-review-list">${item.needsReview.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
        <div class="voice-draft-actions">
          <button type="button" class="btn-voice-small draft-split">이 카드 나누기</button>
          <button type="button" class="btn-voice-small draft-merge" ${index === 0 ? 'disabled' : ''}>이전 카드와 합치기</button>
          <button type="button" class="btn-text-danger draft-delete">삭제</button>
        </div>
      </article>
    `).join('');
    bindDraftEvents();
  }

  function bindDraftEvents() {
    document.querySelectorAll('.voice-draft-card').forEach((card) => {
      const index = Number(card.dataset.draftIndex);
      const fieldMap = {
        '.draft-selected': 'selected', '.draft-type': 'type', '.draft-name': 'name',
        '.draft-specs': 'specs', '.draft-qty': 'qty', '.draft-unit': 'unit', '.draft-remarks': 'remarks'
      };
      Object.entries(fieldMap).forEach(([selector, key]) => {
        card.querySelector(selector).addEventListener(key === 'selected' ? 'change' : 'input', (event) => {
          state.drafts[index][key] = key === 'selected' ? event.target.checked : event.target.value;
        });
      });
      card.querySelector('.draft-delete').addEventListener('click', () => {
        state.drafts.splice(index, 1);
        renderDrafts();
      });
      card.querySelector('.draft-merge').addEventListener('click', () => mergeDraft(index));
      card.querySelector('.draft-split').addEventListener('click', () => splitDraft(index));
    });
  }

  function mergeDraft(index) {
    if (index < 1) return;
    const previous = state.drafts[index - 1];
    const current = state.drafts[index];
    previous.name = [previous.name, current.name].filter(Boolean).join(' / ');
    previous.specs = [previous.specs, current.specs].filter(Boolean).join('; ');
    previous.remarks = [previous.remarks, current.remarks].filter(Boolean).join('; ');
    previous.needsReview = [...new Set([...previous.needsReview, ...current.needsReview, '합친 항목의 수량과 단위를 확인해 주세요.'])];
    previous.boundaryUncertain = false;
    state.drafts.splice(index, 1);
    renderDrafts();
  }

  function splitDraft(index) {
    const original = state.drafts[index];
    const copy = normalizeDraft({
      type: original.type,
      name: '',
      specs: '',
      qty: '',
      unit: original.unit,
      remarks: '',
      needsReview: ['나눈 물건의 내용을 입력해 주세요.'],
      sourceExcerpt: original.sourceExcerpt
    });
    original.needsReview = [...new Set([...original.needsReview, '나눈 뒤 각 물건의 내용을 확인해 주세요.'])];
    state.drafts.splice(index + 1, 0, copy);
    renderDrafts();
  }

  function registerSelectedItems() {
    syncDraftsFromDom();
    const selected = state.drafts.filter((item) => item.selected);
    if (!selected.length) {
      showError('등록할 물건을 하나 이상 선택해 주세요.');
      return;
    }
    selected.forEach((item) => {
      addTableDataRow({
        type: configuredTypes().includes(item.type) ? item.type : '기타지장물',
        name: item.name,
        specs: item.specs,
        qty: item.qty,
        unit: item.unit || '개',
        remarks: [item.remarks, ...item.needsReview.map((note) => `확인 필요: ${note}`)].filter(Boolean).join(' / '),
        location: compactAddressFromDong(db.survey.location),
        hasLedger: false,
        isBusiness: false,
        isResidence: false,
        image: '',
        compositeImage: '',
        overlayEnabled: true
      });
    });
    logVoiceMetric('items_registered', {
      registeredCount: selected.length,
      reviewRequiredCount: selected.filter((item) => item.needsReview.length || item.boundaryUncertain).length
    });
    log(`AI 음성 물건 ${selected.length}건 등록 완료`, 'success');
    closeModal();
  }

  function syncDraftsFromDom() {
    document.querySelectorAll('.voice-draft-card').forEach((card) => {
      const item = state.drafts[Number(card.dataset.draftIndex)];
      if (!item) return;
      item.selected = card.querySelector('.draft-selected').checked;
      item.type = card.querySelector('.draft-type').value.trim();
      item.name = card.querySelector('.draft-name').value.trim();
      item.specs = card.querySelector('.draft-specs').value.trim();
      item.qty = card.querySelector('.draft-qty').value.trim();
      item.unit = card.querySelector('.draft-unit').value.trim();
      item.remarks = card.querySelector('.draft-remarks').value.trim();
    });
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function openQueueDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function queueRecording(blob, durationSeconds, lastError) {
    const database = await openQueueDb();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).add({
        blob, durationSeconds, lastError, createdAt: new Date().toISOString(), attempts: 0
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function listQueuedRecordings() {
    const database = await openQueueDb();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteQueuedRecording(id) {
    const database = await openQueueDb();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  async function clearQueue() {
    if (!confirm('이 기기에 보관된 전송 대기 녹음을 모두 삭제할까요? 복구할 수 없습니다.')) return;
    const database = await openQueueDb();
    await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    refreshQueueCount();
  }

  async function retryQueue() {
    if (!navigator.onLine) {
      showError('현재 오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.');
      return;
    }
    const queued = await listQueuedRecordings();
    if (!queued.length) return;
    const first = queued[0];
    state.currentBlob = first.blob;
    state.durationSeconds = first.durationSeconds;
    await transcribeCurrentBlob(first.id);
    refreshQueueCount();
  }

  async function refreshQueueCount() {
    try {
      const count = (await listQueuedRecordings()).length;
      $('voiceQueueCount').textContent = count;
      $('voiceQueueBox').classList.toggle('hidden', count === 0);
    } catch (_) {
      $('voiceQueueBox').classList.add('hidden');
    }
  }

  function logVoiceMetric(event, details) {
    const metrics = JSON.parse(localStorage.getItem('digijosaVoiceMetrics') || '[]');
    metrics.push({ timestamp: new Date().toISOString(), event, ...details });
    localStorage.setItem('digijosaVoiceMetrics', JSON.stringify(metrics.slice(-500)));
  }

  $('btnOpenVoiceEntry').addEventListener('click', openModal);
  $('btnCloseVoiceModal').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  $('btnStartVoiceRecording').addEventListener('click', startRecording);
  $('btnStopVoiceRecording').addEventListener('click', stopRecording);
  $('btnBackToRecording').addEventListener('click', () => { setStep('record'); resetRecorderUi(); });
  $('btnStructureVoiceItems').addEventListener('click', structureItems);
  $('voiceTranscript').addEventListener('input', runPrivacyPreview);
  $('btnBackToTranscript').addEventListener('click', () => setStep('transcript'));
  $('btnRegisterVoiceItems').addEventListener('click', registerSelectedItems);
  $('btnRetryVoiceQueue').addEventListener('click', retryQueue);
  $('btnClearVoiceQueue').addEventListener('click', clearQueue);
  window.addEventListener('online', refreshQueueCount);
  refreshQueueCount();
})();
