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

// Get room details
router.get('/:roomCode', roomController.getRoom);

module.exports = router;
