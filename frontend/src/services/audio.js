// Frontend microphone + audio chunking. getUserMedia -> MediaRecorder -> binary chunks.
// The MediaStream itself is never sent anywhere; only encoded audio bytes are handed to onChunk.
const CHUNK_MS = 250; // MediaRecorder timeslice: one chunk every 250 ms
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
let stream = null, recorder = null;

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
export async function start(onChunk) {
  stop();
  stream = await open();
  const mimeType = pickMime();
  const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  r.ondataavailable = async (e) => {
    if (!e.data || !e.data.size) return;
    const audioData = await e.data.arrayBuffer();
    onChunk?.({ audioData, mimeType: r.mimeType || mimeType, timestamp: Date.now() });
  };
  r.start(CHUNK_MS);
  recorder = r;
  return stream;
}
// Muting pauses the recorder so no chunks are produced (and the encoded stream stays continuous).
export function setMuted(m) {
  if (!recorder) return;
  if (m && recorder.state === 'recording') recorder.pause();
  if (!m && recorder.state === 'paused') recorder.resume();
}
export function stop() {
  try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
  stream?.getTracks().forEach((t) => t.stop());
  recorder = null; stream = null;
}
