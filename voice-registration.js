/**
 * Optional AI voice item registration.
 * The manual item-entry path remains untouched and fully functional.
 */
(function () {
  'use strict';

  const MAX_SECONDS = 60;
  const DB_NAME = 'digijosa-voice-queue';
  const STORE_NAME = 'recordings';
  const API_BASE = (window.DIGIJOSA_API_BASE || '').replace(/\/$/, '');
  const configuredTypes = () => typeof SURVEY_ITEM_TYPES !== 'undefined' ? SURVEY_ITEM_TYPES : [];
  const configuredUnits = () => typeof SURVEY_ITEM_UNITS !== 'undefined' ? SURVEY_ITEM_UNITS : [];
  const state = {
    stream: null,
    recorder: null,
    chunks: [],
    timerId: null,
    meterFrame: null,
    audioContext: null,
    startedAt: 0,
    durationSeconds: 0,
    currentBlob: null,
    drafts: [],
    transcript: ''
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
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    setStep('record');
    refreshQueueCount();
    lucide.createIcons();
  }

  function closeModal() {
    stopMedia();
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function stopMedia() {
    clearInterval(state.timerId);
    cancelAnimationFrame(state.meterFrame);
    if (state.recorder && state.recorder.state === 'recording') state.recorder.stop();
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    if (state.audioContext) state.audioContext.close().catch(() => {});
    state.stream = null;
    state.recorder = null;
    state.audioContext = null;
  }

  function formatTimer(seconds) {
    return `00:${String(Math.min(60, seconds)).padStart(2, '0')} / 01:00`;
  }

  function selectMimeType() {
    const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
    return candidates.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || '';
  }

  async function startRecording() {
    hideError();
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      showError('이 브라우저에서는 음성 녹음을 지원하지 않습니다. 기존 직접 등록을 이용해 주세요.');
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const mimeType = selectMimeType();
      state.recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);
      state.chunks = [];
      state.startedAt = Date.now();
      state.durationSeconds = 0;
      state.recorder.ondataavailable = (event) => {
        if (event.data.size) state.chunks.push(event.data);
      };
      state.recorder.onstop = async () => {
        const blobType = state.recorder?.mimeType || mimeType || 'audio/webm';
        state.currentBlob = new Blob(state.chunks, { type: blobType });
        stopMedia();
        if (state.currentBlob.size < 1000) {
          showError('녹음된 음성이 너무 짧습니다. 다시 녹음해 주세요.');
          resetRecorderUi();
          return;
        }
        await transcribeCurrentBlob();
      };
      state.recorder.start(250);
      $('btnStartVoiceRecording').classList.add('hidden');
      $('btnStopVoiceRecording').classList.remove('hidden');
      $('voiceRecordingStatus').textContent = '● 녹음 중';
      $('voiceRecordingStatus').classList.add('is-recording');
      beginTimer();
      beginMeter(state.stream);
    } catch (error) {
      showError(error.name === 'NotAllowedError'
        ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용하거나 직접 등록을 이용해 주세요.'
        : `마이크를 시작하지 못했습니다: ${error.message}`);
    }
  }

  function beginTimer() {
    state.timerId = setInterval(() => {
      state.durationSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
      $('voiceTimer').textContent = formatTimer(state.durationSeconds);
      if (state.durationSeconds >= MAX_SECONDS) stopRecording();
    }, 250);
  }

  function beginMeter(stream) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = state.audioContext.createAnalyser();
    analyser.fftSize = 256;
    state.audioContext.createMediaStreamSource(stream).connect(analyser);
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

  function stopRecording() {
    if (state.recorder && state.recorder.state === 'recording') {
      state.recorder.stop();
      $('btnStopVoiceRecording').classList.add('hidden');
      $('voiceRecordingStatus').textContent = '녹음 처리 중';
    }
  }

  function resetRecorderUi() {
    $('btnStartVoiceRecording').classList.remove('hidden');
    $('btnStopVoiceRecording').classList.add('hidden');
    $('voiceRecordingStatus').textContent = '녹음 준비';
    $('voiceRecordingStatus').classList.remove('is-recording');
    $('voiceMeterFill').style.width = '0';
    $('voiceTimer').textContent = '00:00 / 01:00';
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
