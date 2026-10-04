/**
 * Room Service
 * All room business logic lives here — controllers and socket handlers
 * delegate to these functions.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  createRoomObject,
  createParticipantObject,
  getRoom,
  setRoom,
  hasRoom,
} = require('../models/room');
const { generateRoomCode } = require('../utils/roomCode');

const TRANSCRIPTS_DIR = path.join(__dirname, '../../data/transcripts');

function ensureTranscriptsDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}
try { ensureTranscriptsDir(); } catch (_) {}

function getTranscriptFilePath(roomCode) {
  const safeCode = (roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return path.join(TRANSCRIPTS_DIR, `${safeCode}.json`);
}

function loadTranscriptsFromDisk(roomCode) {
  try {
    const filePath = getTranscriptFilePath(roomCode);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error(`[PERSISTENCE] Error reading transcripts for ${roomCode}:`, err.message);
  }
  return [];
}

function saveTranscriptsToDisk(roomCode, transcripts) {
  try {
    ensureTranscriptsDir();
    const filePath = getTranscriptFilePath(roomCode);
    const tempPath = `${filePath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(transcripts, null, 2), 'utf8');
    try {
      fs.renameSync(tempPath, filePath);
    } catch (_) {
      fs.copyFileSync(tempPath, filePath);
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  } catch (err) {
    console.error(`[PERSISTENCE] Error saving transcripts for ${roomCode}:`, err.message);
  }
}

// ────────────────────────────────────────────────────────────────────
// CREATE ROOM
// ────────────────────────────────────────────────────────────────────
function createRoom(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw { status: 400, message: 'Participant name is required' };
  }

  const roomCode = generateRoomCode();
  const participant = createParticipantObject({ id: uuidv4(), name: name.trim() });
  const room = createRoomObject(roomCode, participant);

  setRoom(roomCode, room);

  return { roomCode, participant: { id: participant.id, name: participant.name } };
}

// ────────────────────────────────────────────────────────────────────
// JOIN ROOM
// ────────────────────────────────────────────────────────────────────
function joinRoom(roomCode, name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw { status: 400, message: 'Participant name is required' };
  }
  if (!roomCode || typeof roomCode !== 'string') {
    throw { status: 400, message: 'Room code is required' };
  }

  const room = getRoom(roomCode);
  if (!room) {
    throw { status: 404, message: 'Room not found' };
  }
  if (room.status !== 'active') {
    throw { status: 400, message: 'Room is no longer active' };
  }

  const participant = createParticipantObject({ id: uuidv4(), name: name.trim() });
  room.participants.push(participant);

  // Return existing participants (excluding the one who just joined)
  const existingParticipants = room.participants
    .filter((p) => p.id !== participant.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }));

  return {
    roomCode,
    participant: { id: participant.id, name: participant.name },
    participants: existingParticipants,
  };
}

// ────────────────────────────────────────────────────────────────────
// GET ROOM
// ────────────────────────────────────────────────────────────────────
function getRoomDetails(roomCode) {
  if (!roomCode || typeof roomCode !== 'string') {
    throw { status: 400, message: 'Room code is required' };
  }

  const normCode = roomCode.trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) {
    throw { status: 404, message: 'Room not found' };
  }

  // Restore transcripts from disk if in-memory list is empty
  if (room.transcripts.length === 0) {
    const diskTranscripts = loadTranscriptsFromDisk(normCode);
    if (diskTranscripts.length > 0) {
      room.transcripts = diskTranscripts;
    }
  }

  return {
    roomCode: room.roomCode,
    createdAt: room.createdAt,
    status: room.status,
    participants: room.participants.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      joinedAt: p.joinedAt,
    })),
    transcripts: room.transcripts,
  };
}

// ────────────────────────────────────────────────────────────────────
// ENSURE PARTICIPANT (Idempotent: finds existing or registers new without duplicates)
// ────────────────────────────────────────────────────────────────────
function ensureParticipant(roomCode, participantId, name) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  let participant = room.participants.find((p) => p.id === participantId);
  if (participant) {
    if (name && typeof name === 'string' && name.trim()) {
      participant.name = name.trim();
    }
    return { participant, isNew: false };
  }

  const cleanName = (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Participant';
  participant = createParticipantObject({ id: participantId, name: cleanName });
  room.participants.push(participant);
  return { participant, isNew: true };
}

// ────────────────────────────────────────────────────────────────────
// REMOVE PARTICIPANT
// ────────────────────────────────────────────────────────────────────
function removeParticipant(roomCode, participantId) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  const idx = room.participants.findIndex((p) => p.id === participantId);
  if (idx === -1) return null;

  const [removed] = room.participants.splice(idx, 1);
  return removed;
}

// ────────────────────────────────────────────────────────────────────
// UPDATE PARTICIPANT STATUS
// ────────────────────────────────────────────────────────────────────
function updateParticipantStatus(roomCode, participantId, status) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  participant.status = status;
  return participant;
}

// ────────────────────────────────────────────────────────────────────
// BIND / UNBIND SOCKET ID
// ────────────────────────────────────────────────────────────────────
function bindSocket(roomCode, participantId, socketId) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  participant.socketId = socketId;
  participant.status = 'connected';
  return participant;
}

function unbindSocket(roomCode, participantId, socketId = null) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  // Stale disconnect guard: if a socketId is provided and participant already has a different active socketId, ignore
  if (socketId && participant.socketId && participant.socketId !== socketId) {
    return participant;
  }

  participant.socketId = null;
  participant.status = 'disconnected';
  return participant;
}

// ────────────────────────────────────────────────────────────────────
// ADD TRANSCRIPT (Persisted to disk, final transcripts only)
// ────────────────────────────────────────────────────────────────────
function addTranscript(roomCode, transcript) {
  if (!roomCode || !transcript) return null;
  const normCode = roomCode.trim().toUpperCase();
  const room = getRoom(normCode);

  // Normalize transcript data contract
  const normalized = {
    transcriptId: transcript.transcriptId || uuidv4(),
    roomId: transcript.roomId || transcript.roomCode || normCode,
    speakerId: transcript.speakerId || transcript.participantId || 'unknown',
    speakerName: transcript.speakerName || 'Speaker',
    text: transcript.text || '',
    timestamp: transcript.timestamp || Date.now(),
    isFinal: true,
    confidence: typeof transcript.confidence === 'number' ? transcript.confidence : 1.0,
  };

  let currentList = [];
  if (room) {
    const exists = room.transcripts.some((t) => t.transcriptId === normalized.transcriptId);
    if (!exists) {
      room.transcripts.push(normalized);
    }
    currentList = room.transcripts;
  } else {
    currentList = loadTranscriptsFromDisk(normCode);
    const exists = currentList.some((t) => t.transcriptId === normalized.transcriptId);
    if (!exists) {
      currentList.push(normalized);
    }
  }

  // Persist to disk (FINAL transcripts only)
  saveTranscriptsToDisk(normCode, currentList);

  return normalized;
}

// ────────────────────────────────────────────────────────────────────
// GET ROOM HISTORY (with optional search)
// ────────────────────────────────────────────────────────────────────
function getRoomHistory(roomCode, search) {
  if (!roomCode || typeof roomCode !== 'string') {
    throw { status: 400, message: 'Room code is required' };
  }
  const normCode = roomCode.trim().toUpperCase();

  // Try in-memory first; fallback to disk
  let transcripts = [];
  const room = getRoom(normCode);
  if (room && room.transcripts && room.transcripts.length > 0) {
    transcripts = [...room.transcripts];
  } else {
    transcripts = loadTranscriptsFromDisk(normCode);
    if (room && room.transcripts.length === 0) {
      room.transcripts = transcripts;
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    transcripts = transcripts.filter(
      (t) =>
        (t.text && t.text.toLowerCase().includes(q)) ||
        (t.speakerName && t.speakerName.toLowerCase().includes(q))
    );
  }

  return {
    roomCode: normCode,
    transcripts,
  };
}

// ────────────────────────────────────────────────────────────────────
// GENERATE TXT EXPORT
// ────────────────────────────────────────────────────────────────────
function generateTxtExport(roomCode) {
  const { transcripts } = getRoomHistory(roomCode);
  const normCode = (roomCode || '').trim().toUpperCase();

  let out = `RoundTABLE Conversation\nRoom: ${normCode}\n\n`;
  if (!transcripts || transcripts.length === 0) {
    out += `No final transcripts recorded for this room.\n`;
    return out;
  }

  transcripts.forEach((t) => {
    let timeStr = '00:00:00';
    try {
      const d = new Date(t.timestamp);
      if (!isNaN(d.getTime())) {
        timeStr = d.toTimeString().split(' ')[0];
      }
    } catch (_) {}

    out += `[${timeStr}] ${t.speakerName || 'Speaker'}:\n${t.text}\n\n`;
  });

  return out;
}

// ────────────────────────────────────────────────────────────────────
// GENERATE SRT EXPORT
// ────────────────────────────────────────────────────────────────────
function generateSrtExport(roomCode) {
  const { transcripts } = getRoomHistory(roomCode);
  if (!transcripts || transcripts.length === 0) {
    return '1\n00:00:00,000 --> 00:00:03,000\nNo transcript available\n';
  }

  function formatSrtTime(totalMs) {
    const ms = Math.floor(Math.max(0, totalMs) % 1000);
    const totalSec = Math.floor(Math.max(0, totalMs) / 1000);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  }

  let t0 = 0;
  try {
    const d0 = new Date(transcripts[0].timestamp).getTime();
    if (!isNaN(d0)) t0 = d0;
  } catch (_) {}

  let srt = '';
  let prevEndMs = 0;
  const UTTERANCE_DURATION_MS = 3000;

  transcripts.forEach((t, idx) => {
    let startMs = 0;
    try {
      const curTime = new Date(t.timestamp).getTime();
      if (!isNaN(curTime) && t0 > 0) {
        startMs = Math.max(0, curTime - t0);
      } else {
        startMs = idx * UTTERANCE_DURATION_MS;
      }
    } catch (_) {
      startMs = idx * UTTERANCE_DURATION_MS;
    }

    if (startMs < prevEndMs) {
      startMs = prevEndMs;
    }

    const endMs = startMs + UTTERANCE_DURATION_MS;
    prevEndMs = endMs;

    srt += `${idx + 1}\n`;
    srt += `${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n`;
    srt += `${t.speakerName || 'Speaker'}: ${t.text}\n\n`;
  });

  return srt;
}

// ────────────────────────────────────────────────────────────────────
// FIND PARTICIPANT BY SOCKET ID (for disconnect handling)
// ────────────────────────────────────────────────────────────────────
function findParticipantBySocketId(socketId) {
  // We need to import rooms directly here
  const { rooms } = require('../models/room');

  for (const [roomCode, room] of rooms) {
    const participant = room.participants.find((p) => p.socketId === socketId);
    if (participant) {
      return { roomCode, participant };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────
// VALIDATE PARTICIPANT IN ROOM
// ────────────────────────────────────────────────────────────────────
function validateParticipant(roomCode, participantId) {
  const normCode = (roomCode || '').trim().toUpperCase();
  const room = getRoom(normCode);
  if (!room) return null;

  return room.participants.find((p) => p.id === participantId) || null;
}

module.exports = {
  createRoom,
  joinRoom,
  ensureParticipant,
  getRoomDetails,
  removeParticipant,
  updateParticipantStatus,
  bindSocket,
  unbindSocket,
  addTranscript,
  getRoomHistory,
  generateTxtExport,
  generateSrtExport,
  loadTranscriptsFromDisk,
  findParticipantBySocketId,
  validateParticipant,
};
