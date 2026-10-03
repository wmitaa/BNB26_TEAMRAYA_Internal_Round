/**
 * Room Model
 * In-memory room and participant data structures for the hackathon.
 * No database required — rooms live in a Map keyed by roomCode.
 */

// ── In-memory store ────────────────────────────────────────────────
const rooms = new Map();

// ── Factory: create a new Room object ──────────────────────────────
function createRoomObject(roomCode, creatorParticipant) {
  return {
    roomCode,
    createdAt: Date.now(),
    status: 'active',               // active | ended
    participants: [creatorParticipant],
    transcripts: [],                 // ordered list of final transcripts
  };
}

// ── Factory: create a new Participant object ───────────────────────
function createParticipantObject({ id, name }) {
  return {
    id,
    name,
    status: 'connected',            // connected | disconnected | reconnecting
    joinedAt: Date.now(),
    socketId: null,
  };
}

// ── Store helpers ──────────────────────────────────────────────────
function getRoom(roomCode) {
  return rooms.get(roomCode) || null;
}

function setRoom(roomCode, room) {
  rooms.set(roomCode, room);
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

function hasRoom(roomCode) {
  return rooms.has(roomCode);
}

function getAllRoomCodes() {
  return [...rooms.keys()];
}

module.exports = {
  rooms,
  createRoomObject,
  createParticipantObject,
  getRoom,
  setRoom,
  deleteRoom,
  hasRoom,
  getAllRoomCodes,
};
