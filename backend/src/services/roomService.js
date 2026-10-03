/**
 * Room Service
 * All room business logic lives here — controllers and socket handlers
 * delegate to these functions.
 */

const { v4: uuidv4 } = require('uuid');
const {
  createRoomObject,
  createParticipantObject,
  getRoom,
  setRoom,
  hasRoom,
} = require('../models/room');
const { generateRoomCode } = require('../utils/roomCode');

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

  const room = getRoom(roomCode);
  if (!room) {
    throw { status: 404, message: 'Room not found' };
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
// REMOVE PARTICIPANT
// ────────────────────────────────────────────────────────────────────
function removeParticipant(roomCode, participantId) {
  const room = getRoom(roomCode);
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
  const room = getRoom(roomCode);
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
  const room = getRoom(roomCode);
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  participant.socketId = socketId;
  participant.status = 'connected';
  return participant;
}

function unbindSocket(roomCode, participantId) {
  const room = getRoom(roomCode);
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  participant.socketId = null;
  participant.status = 'disconnected';
  return participant;
}

// ────────────────────────────────────────────────────────────────────
// ADD TRANSCRIPT
// ────────────────────────────────────────────────────────────────────
function addTranscript(roomCode, transcript) {
  const room = getRoom(roomCode);
  if (!room) return null;

  room.transcripts.push(transcript);
  return transcript;
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
// VALIDATE PARTICIPANT IN ROOM
// ────────────────────────────────────────────────────────────────────
function validateParticipant(roomCode, participantId) {
  const room = getRoom(roomCode);
  if (!room) return null;

  return room.participants.find((p) => p.id === participantId) || null;
}

module.exports = {
  createRoom,
  joinRoom,
  getRoomDetails,
  removeParticipant,
  updateParticipantStatus,
  bindSocket,
  unbindSocket,
  addTranscript,
  findParticipantBySocketId,
  validateParticipant,
};
