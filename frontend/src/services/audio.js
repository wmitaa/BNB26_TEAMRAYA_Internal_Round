// Frontend microphone + audio chunking. getUserMedia -> MediaRecorder -> binary chunks.
// The MediaStream itself is never sent anywhere; only encoded audio bytes are handed to onChunk.
const CHUNK_MS = 250; // MediaRecorder timeslice: one chunk every 250 ms
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
let stream = null, recorder = null;

// Web Audio API health analysis resources
let audioCtx = null;
let sourceNode = null;
let analyserNode = null;
let metricsInterval = null;
let lastChunkTime = 0;
let lastChunkInterval = CHUNK_MS;
let rollingSilence = [];

export const isSupported = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const pickMime = () => MIMES.find((m) => window.MediaRecorder.isTypeSupported?.(m));
const codeOf = (e) => (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unavailable');
const open = async () => {
  if (!isSupported()) throw { code: 'unavailable' };
  try { return await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { throw { code: codeOf(e) }; }
};

export async function queryPermission() {
  if (!isSupported()) return 'unavailable';
  try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch { return 'prompt'; }
}
// Permission probe only (used on the Join page): opens the mic, then releases it immediately.
export async function requestAccess() { (await open()).getTracks().forEach((t) => t.stop()); return 'granted'; }

// onChunk receives { audioData: ArrayBuffer, mimeType, timestamp }.
// onHealth receives { status, dbfs, peak, clippingPercent, silencePercent, chunkIntervalMs }.
export async function start(onChunk, onHealth) {
  stop();
  stream = await open();
  const mimeType = pickMime();
  const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  lastChunkTime = 0;
  lastChunkInterval = CHUNK_MS;
  rollingSilence = [];

  r.ondataavailable = async (e) => {
    if (!e.data || !e.data.size) return;
    const now = Date.now();
    if (lastChunkTime > 0) {
      lastChunkInterval = now - lastChunkTime;
    }
    lastChunkTime = now;

    const audioData = await e.data.arrayBuffer();
    onChunk?.({ audioData, mimeType: r.mimeType || mimeType, timestamp: now });
  };
  r.start(CHUNK_MS);
  recorder = r;

  // Initialize Web Audio API analyzer if available
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      sourceNode = audioCtx.createMediaStreamSource(stream);
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 1024;
      sourceNode.connect(analyserNode);

      const dataArray = new Float32Array(analyserNode.fftSize);

      metricsInterval = setInterval(() => {
        if (!analyserNode) return;
        analyserNode.getFloatTimeDomainData(dataArray);

        let sumSq = 0;
        let peak = 0;
        let clipCount = 0;
        const len = dataArray.length;

        for (let i = 0; i < len; i++) {
          const val = dataArray[i];
          const abs = Math.abs(val);
          if (abs > peak) peak = abs;
          if (abs >= 0.98) clipCount++;
          sumSq += val * val;
        }

        const rms = Math.sqrt(sumSq / len);
        // Approximate dBFS (-80 to 0)
        const dbfs = Math.round(20 * Math.log10(Math.max(rms, 1e-4)));
        const clippingPercent = Math.round((clipCount / len) * 100);

        // Frame is silent if RMS < 0.008 (approx -42 dBFS)
        const isSilent = rms < 0.008;
        rollingSilence.push(isSilent ? 1 : 0);
        if (rollingSilence.length > 12) rollingSilence.shift();
        const silencePercent = Math.round(
          (rollingSilence.reduce((a, b) => a + b, 0) / rollingSilence.length) * 100
        );

        // Classify stream health status
        let status = 'good';
        if (clippingPercent >= 1 || dbfs <= -65 || lastChunkInterval > 800) {
          status = 'poor';
        } else if (dbfs <= -42 || silencePercent > 60 || lastChunkInterval > 450) {
          status = 'fair';
        } else {
          status = 'good';
        }

        // Conservative condition classification heuristic (not environmental noise ML classification)
        let condition = 'normal';
        let conditionLabel = 'Audio normal';
        if (lastChunkInterval > 650) {
          condition = 'unstable';
          conditionLabel = 'Unstable cadence';
        } else if (clippingPercent >= 1 || (peak >= 0.98 && dbfs >= -3)) {
          condition = 'noisy/clipping';
          conditionLabel = 'Possible clipping/noise';
        } else if (dbfs <= -48 || (silencePercent >= 75 && dbfs <= -40)) {
          condition = 'quiet';
          conditionLabel = 'Low audio signal';
        } else {
          condition = 'normal';
          conditionLabel = 'Audio normal';
        }

        // Realtime speech activity heuristic (active when not silent and signal exceeds speech threshold)
        const isSpeaking = !isSilent && rms >= 0.01 && dbfs > -42;

        onHealth?.({
          status,
          condition,
          conditionLabel,
          isSpeaking,
          dbfs,
          peak: Number(peak.toFixed(2)),
          clippingPercent,
          silencePercent,
          chunkIntervalMs: Math.round(lastChunkInterval),
        });
      }, 250);
    }
  } catch (err) {
    console.warn('[AUDIO] Web Audio API analyzer unavailable:', err.message);
  }

  return stream;
}

// Muting pauses the recorder so no chunks are produced (and the encoded stream stays continuous).
export function setMuted(m) {
  if (!recorder) return;
  if (m && recorder.state === 'recording') recorder.pause();
  if (!m && recorder.state === 'paused') recorder.resume();
}

export function stop() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (_) {}
    sourceNode = null;
  }
  if (analyserNode) {
    try { analyserNode.disconnect(); } catch (_) {}
    analyserNode = null;
  }
  if (audioCtx) {
    try {
      if (audioCtx.state !== 'closed') audioCtx.close();
    } catch (_) {}
    audioCtx = null;
  }
  rollingSilence = [];
  lastChunkTime = 0;
  lastChunkInterval = CHUNK_MS;

  try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
  stream?.getTracks().forEach((t) => t.stop());
  recorder = null; stream = null;
}
