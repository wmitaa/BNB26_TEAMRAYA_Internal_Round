// Realtime layer: Socket.IO only (no native WebSocket).
// REAL mode contract:
//   handshake  io(origin, { auth: { roomId, roomCode, participantId, participantName } })
//   emit  'audio:chunk'    { audioData: ArrayBuffer, mimeType, timestamp(ms epoch) }
//   on    'transcript:new' { transcriptId, roomId, speakerId, speakerName, text, timestamp, isFinal, confidence }
// Connection status comes from Socket.IO lifecycle events. Everything else the UI shows in real mode
// (participants, speaking) is derived from transcript:new — no other events are assumed.
// MOCK mode emits the same 'transcript:new' payloads, plus mock-only demo events (never emitted in real mode).
import { io } from 'socket.io-client';
import { isMock, SOCKET_URL } from '../utils/config.js';
import { demoScript, demoParticipants, demoTranscript } from '../utils/demoData.js';

const listeners = {};
let sock = null, timers = [], last = null;
const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));
export const on = (e, f) => {
  (listeners[e] = listeners[e] || []).push(f);
  return () => { listeners[e] = listeners[e].filter((x) => x !== f); };
};

// ===== MOCK (mock mode only) =====
const nameOf = (id) => demoParticipants.find((p) => p.id === id)?.name;
const toWire = (m) => ({ transcriptId: m.id, roomId: 'mock-room', speakerId: m.speakerId, speakerName: nameOf(m.speakerId),
  text: m.text, timestamp: Date.now(), isFinal: m.status === 'final', confidence: m.confidence });
function runMock(me) {
  timers.push(setTimeout(() => {
    emit('status', 'connected');
    emit('snapshot', {
      participants: [{ id: me.id, name: me.name, color: 'purple', muted: true }, ...demoParticipants.map((p) => ({ ...p }))],
      transcript: demoTranscript.map((t) => ({ ...t })),
      overlap: { active: false, speakers: [] }, audio: { status: 'good' },
    });
  }, 900));
  demoScript.forEach(([ms, ev, payload]) => timers.push(setTimeout(
    () => (ev === 'transcript' ? emit('transcript:new', toWire(payload)) : emit(ev, payload)), 900 + ms)));
}

// ===== REAL (real mode only) =====
function openReal(s) {
  sock = io(SOCKET_URL, {
    auth: { roomId: s.roomId, roomCode: s.roomCode, participantId: s.participantId, participantName: s.participantName },
    reconnection: true,
  });
  sock.on('connect', () => emit('status', 'connected'));
  sock.on('disconnect', (reason) => emit('status', reason === 'io client disconnect' ? 'disconnected' : 'reconnecting'));
  sock.on('connect_error', () => emit('status', 'reconnecting'));
  sock.io.on('reconnect_attempt', () => emit('status', 'reconnecting'));
  sock.on('transcript:new', (p) => emit('transcript:new', p));
}

export function connect(session) {
  disconnect(); last = session;
  emit('status', 'connecting');
  if (isMock) runMock({ id: session.participantId, name: session.participantName }); else openReal(session);
}
export function disconnect() {
  timers.forEach(clearTimeout); timers = [];
  if (sock) { sock.removeAllListeners(); sock.io.removeAllListeners(); sock.disconnect(); sock = null; }
}
export function reconnect() { if (last) connect(last); }
// Sends one audio chunk; silently dropped when not connected (and always a no-op in mock mode).
export const sendAudioChunk = (chunk) => { if (sock && sock.connected) sock.emit('audio:chunk', chunk); };
