/**
 * Room Controller
 * Thin HTTP layer — delegates all business logic to roomService.
 */

const roomService = require('../services/roomService');

// POST /api/rooms
async function createRoom(req, res) {
  try {
    const { name } = req.body;
    const result = roomService.createRoom(name);

    return res.status(201).json({
      success: true,
      roomCode: result.roomCode,
      participant: result.participant,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    return res.status(status).json({ success: false, error: message });
  }
}

// POST /api/rooms/:roomCode/join
async function joinRoom(req, res) {
  try {
    const { roomCode } = req.params;
    const { name } = req.body;
    const result = roomService.joinRoom(roomCode, name);

    return res.status(200).json({
      success: true,
      roomCode: result.roomCode,
      participant: result.participant,
      participants: result.participants,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    return res.status(status).json({ success: false, error: message });
  }
}

// GET /api/rooms/:roomCode
async function getRoom(req, res) {
  try {
    const { roomCode } = req.params;
    const result = roomService.getRoomDetails(roomCode);

    return res.status(200).json({
      success: true,
      room: result,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    return res.status(status).json({ success: false, error: message });
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
};
