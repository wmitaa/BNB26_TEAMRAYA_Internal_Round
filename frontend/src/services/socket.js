// Realtime layer: Socket.IO client adapter.
// Bridges the frontend useConversation/useSocket internal contract with the backend Socket.IO events.
//
// BACKEND CONTRACT:
//   Client -> Server:
//     - 'join_room'       { roomCode, participantId, name, participantName }
//     - 'leave_room'      { roomCode, participantId }
//     - 'audio_chunk'     { roomCode, participantId, audio, mimeType, timestamp }
//   Server -> Client:
//     - 'room_state'          -> internal 'snapshot'
//     - 'participant_joined'  -> internal 'participants'
//     - 'participant_left'    -> internal 'participants'
//     - 'transcript_interim'  -> internal 'transcript:new' (isFinal: false)
//     - 'transcript_final'    -> internal 'transcript:new' (isFinal: true)
//     - 'overlap_detected'    -> internal 'overlap'
//     - 'connection_status'   -> internal 'status' / 'participants'
//
// FRONTEND INTERNAL CONTRACT:
//   - 'status'          ('connecting' | 'connected' | 'reconnecting' | 'disconnected')
//   - 'snapshot'        { participants, transcript, overlap, audio }
//   - 'transcript:new'  { transcriptId, roomId, speakerId, speakerName, text, timestamp, isFinal, confidence }
//   - 'participants'    { id, name, connected } | Array
//   - 'overlap'         { active, speakers }
//   - 'audio'           { status }

import { io } from 'socket.io-client';
import { isMock, SOCKET_URL } from '../utils/config.js';
import { demoScript, demoParticipants, demoTranscript } from '../utils/demoData.js';

const listeners = {};
let sock = null;
let timers = [];
let last = null;

const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

export const on = (e, f) => {
  listeners[e] = listeners[e] || [];
  listeners[e].push(f);
  return () => {
    listeners[e] = (listeners[e] || []).filter((x) => x !== f);
  };
};

// ===== MOCK (mock mode only) =====
const nameOf = (id) => demoParticipants.find((p) => p.id === id)?.name;
const toWire = (m) => ({
  transcriptId: m.id,
  roomId: 'mock-room',
  roomCode: 'mock-room',
  speakerId: m.speakerId,
  participantId: m.speakerId,
  speakerName: nameOf(m.speakerId),
  text: m.text,
  timestamp: Date.now(),
  isFinal: m.status === 'final',
  confidence: m.confidence,
});

function runMock(me) {
  timers.push(
    setTimeout(() => {
      emit('status', 'connected');
      emit('snapshot', {
        participants: [
          { id: me.id, name: me.name, color: 'purple', muted: true },
          ...demoParticipants.map((p) => ({ ...p })),
        ],
        transcript: demoTranscript.map((t) => ({ ...t })),
        overlap: { active: false, speakers: [] },
        audio: { status: 'good' },
      });
    }, 900)
  );

  demoScript.forEach(([ms, ev, payload]) =>
    timers.push(
      setTimeout(
        () => (ev === 'transcript' ? emit('transcript:new', toWire(payload)) : emit(ev, payload)),
        900 + ms
      )
    )
  );
}

// ===== REAL (real backend mode) =====
function openReal(s) {
  sock = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // 1. Connection lifecycle & join_room
  sock.on('connect', () => {
    emit('status', 'connected');
    const normalizedRoomCode = (s.roomCode || s.roomId || '').trim().toUpperCase();
    console.log(`[REALTIME] Connected to Socket.IO. Joining room: ${normalizedRoomCode} as ${s.participantName} (${s.participantId})`);
    // Explicitly emit join_room with backend-compatible payload
    sock.emit('join_room', {
      roomCode: normalizedRoomCode,
      participantId: s.participantId,
      name: s.participantName,
      participantName: s.participantName,
    });
  });

  sock.on('disconnect', (reason) => {
    console.log(`[REALTIME] Disconnected from Socket.IO: ${reason}`);
    emit('status', reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
  });

  sock.on('connect_error', (err) => {
    console.warn(`[REALTIME] Socket.IO connection error: ${err.message}`);
    emit('status', 'reconnecting');
  });

  if (sock.io) {
    sock.io.on('reconnect_attempt', () => {
      emit('status', 'reconnecting');
    });
  }

  // 2. Room State -> Snapshot
  sock.on('room_state', (data) => {
    if (!data) return;
    console.log('[REALTIME] Received room_state with participants:', data.participants?.length || 0);
    const participants = (data.participants || []).map((p) => ({
      ...p,
      connected: p.status ? p.status !== 'disconnected' : (p.connected ?? true),
    }));
    emit('snapshot', {
      participants,
      transcript: data.transcripts || data.transcript || [],
      overlap: data.overlap || { active: false, speakers: [] },
      audio: data.audio || { status: 'good' },
    });
  });

  // 3. Participants: joined & left
  sock.on('participant_joined', (p) => {
    if (!p) return;
    console.log('[REALTIME] Participant joined event received:', p.name, `(${p.id})`);
    emit('participants', {
      id: p.id,
      name: p.name,
      connected: p.status ? p.status !== 'disconnected' : true,
    });
  });

  sock.on('participant_left', (p) => {
    if (!p) return;
    console.log('[REALTIME] Participant left event received:', p.name, `(${p.id})`);
    emit('participants', {
      id: p.id,
      name: p.name,
      connected: false,
    });
  });

  // 4. Transcripts: interim and final -> transcript:new
  sock.on('transcript_interim', (data) => {
    if (!data) return;
    emit('transcript:new', {
      transcriptId: data.transcriptId || data.id || `interim-${data.participantId}-${data.timestamp || Date.now()}`,
      roomCode: data.roomCode,
      roomId: data.roomCode || data.roomId,
      speakerId: data.participantId || data.speakerId,
      participantId: data.participantId || data.speakerId,
      speakerName: data.speakerName,
      text: data.text,
      timestamp: data.timestamp || Date.now(),
      isFinal: false,
      confidence: data.confidence,
    });
  });

  sock.on('transcript_final', (data) => {
    if (!data) return;
    emit('transcript:new', {
      transcriptId: data.transcriptId || data.id || `final-${data.participantId}-${data.timestamp || Date.now()}`,
      roomCode: data.roomCode,
      roomId: data.roomCode || data.roomId,
      speakerId: data.participantId || data.speakerId,
      participantId: data.participantId || data.speakerId,
      speakerName: data.speakerName,
      text: data.text,
      timestamp: data.timestamp || Date.now(),
      isFinal: true,
      confidence: data.confidence,
    });
  });

  // Direct transcript:new pass-through if backend supports it directly
  sock.on('transcript:new', (data) => {
    if (!data) return;
    emit('transcript:new', data);
  });

  // 5. Overlap
  sock.on('overlap_detected', (data) => {
    if (data) emit('overlap', data);
  });

  // 6. Connection Status
  sock.on('connection_status', (data) => {
    if (!data) return;
    if (data.participantId === s.participantId) {
      if (data.status === 'connected') emit('status', 'connected');
      else if (data.status === 'reconnecting') emit('status', 'reconnecting');
      else if (data.status === 'disconnected') emit('status', 'disconnected');
    }
    emit('participants', {
      id: data.participantId,
      connected: data.status === 'connected',
    });
  });
}

export function connect(session) {
  disconnect(false);
  last = session;
  emit('status', 'connecting');
  if (isMock) {
    runMock({ id: session.participantId, name: session.participantName });
  } else {
    openReal(session);
  }
}

export function disconnect(explicit = false) {
  timers.forEach(clearTimeout);
  timers = [];
  if (sock) {
    if (sock.connected && last && explicit) {
      const normalizedRoomCode = (last.roomCode || last.roomId || '').trim().toUpperCase();
      sock.emit('leave_room', {
        roomCode: normalizedRoomCode,
        participantId: last.participantId,
      });
    }
    sock.removeAllListeners();
    if (sock.io) sock.io.removeAllListeners();
    sock.disconnect();
    sock = null;
  }
}

export function reconnect() {
  if (last) {
    connect(last);
  }
}

// Sends one audio chunk converted to the backend contract:
// socket.emit('audio_chunk', { roomCode, participantId, audio, mimeType, timestamp })
export const sendAudioChunk = (chunk) => {
  if (sock && sock.connected && last && chunk) {
    const normalizedRoomCode = (last.roomCode || last.roomId || '').trim().toUpperCase();
    sock.emit('audio_chunk', {
      roomCode: normalizedRoomCode,
      participantId: last.participantId,
      audio: chunk.audioData,
      mimeType: chunk.mimeType,
      timestamp: chunk.timestamp || Date.now(),
    });
  }
};

// Notifies backend that this participant stopped audio capture
export const stopAudio = () => {
  if (sock && sock.connected && last) {
    const normalizedRoomCode = (last.roomCode || last.roomId || '').trim().toUpperCase();
    sock.emit('stop_audio', {
      roomCode: normalizedRoomCode,
      participantId: last.participantId,
    });
  }
};
