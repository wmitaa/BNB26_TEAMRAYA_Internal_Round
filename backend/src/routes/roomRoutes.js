/**
 * Room Routes
 */

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Create a new room
router.post('/', roomController.createRoom);

// Join an existing room
router.post('/:roomCode/join', roomController.joinRoom);

// Get all persisted conversation sessions (must precede /:roomCode)
router.get('/history', roomController.getAllConversations);

// Get room details
router.get('/:roomCode', roomController.getRoom);

// Get persistent room history with optional ?search=
router.get('/:roomCode/history', roomController.getHistory);

// Export transcripts as TXT
router.get('/:roomCode/export/txt', roomController.exportTxt);

// Export transcripts as SRT
router.get('/:roomCode/export/srt', roomController.exportSrt);

module.exports = router;
