/**
 * Socket.IO Handler
 *
 * Client → Server events:   join_room, leave_room, audio_chunk
 * Server → Client events:   room_state, participant_joined, participant_left,
 *                            transcript_interim, transcript_final,
 *                            overlap_detected, connection_status
 *
 * Room isolation: every broadcast uses io.to(roomCode) so rooms never leak.
 */

const roomService = require('../services/roomService');
const audioService = require('../services/audioService');

function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id}`);

    // Track which room + participant this socket belongs to
    let currentRoomCode = null;
    let currentParticipantId = null;

    // ──────────────────────────────────────────────────────────────
    // JOIN ROOM
    // ──────────────────────────────────────────────────────────────
    socket.on('join_room', (data, callback) => {
      try {
        const { roomCode, participantId, name } = data || {};

        // Validate payload
        if (!roomCode || !participantId) {
          const err = { success: false, error: 'roomCode and participantId are required' };
          if (typeof callback === 'function') return callback(err);
          return socket.emit('error_event', err);
        }

        // Validate room exists
        const room = roomService.getRoomDetails(roomCode);
        if (!room) {
          const err = { success: false, error: 'Room not found' };
          if (typeof callback === 'function') return callback(err);
          return socket.emit('error_event', err);
        }

        // Validate participant is registered in the room
        const participant = roomService.validateParticipant(roomCode, participantId);
        if (!participant) {
          const err = { success: false, error: 'Participant not found in this room' };
          if (typeof callback === 'function') return callback(err);
          return socket.emit('error_event', err);
        }

        // Check if this is a reconnection (participant was previously connected)
        const isReconnect = participant.status === 'disconnected' || participant.status === 'reconnecting';

        // 1. Join the Socket.IO room
        socket.join(roomCode);

        // 2. Bind socket ID and mark connected
        roomService.bindSocket(roomCode, participantId, socket.id);

        // 3. Track on this socket instance
        currentRoomCode = roomCode;
        currentParticipantId = participantId;

        // 4. Send current room state to the joining participant
        const updatedRoom = roomService.getRoomDetails(roomCode);
        socket.emit('room_state', {
          roomCode: updatedRoom.roomCode,
          participants: updatedRoom.participants,
          transcripts: updatedRoom.transcripts,
          status: updatedRoom.status,
        });

        // 5. Notify other participants
        socket.to(roomCode).emit('participant_joined', {
          id: participant.id,
          name: participant.name,
          status: 'connected',
        });

        // 6. Broadcast connection status
        io.to(roomCode).emit('connection_status', {
          participantId: participant.id,
          status: 'connected',
        });

        console.log(
          `[SOCKET] ${participant.name} (${participantId}) ${isReconnect ? 'reconnected to' : 'joined'} room ${roomCode}`
        );

        if (typeof callback === 'function') {
          callback({ success: true, roomCode, participantId: participant.id });
        }
      } catch (err) {
        console.error('[SOCKET] join_room error:', err.message || err);
        const errPayload = { success: false, error: err.message || 'Failed to join room' };
        if (typeof callback === 'function') return callback(errPayload);
        socket.emit('error_event', errPayload);
      }
    });

    // ──────────────────────────────────────────────────────────────
    // LEAVE ROOM
    // ──────────────────────────────────────────────────────────────
    socket.on('leave_room', (data, callback) => {
      try {
        const roomCode = (data && data.roomCode) || currentRoomCode;
        const participantId = (data && data.participantId) || currentParticipantId;

        if (roomCode && participantId) {
          handleParticipantLeave(io, socket, roomCode, participantId, false);
        }

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('[SOCKET] leave_room error:', err.message || err);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // AUDIO CHUNK
    // ──────────────────────────────────────────────────────────────
    socket.on('audio_chunk', (data) => {
      try {
        const roomCode = (data && data.roomCode) || currentRoomCode;
        const participantId = (data && data.participantId) || currentParticipantId;

        if (!roomCode || !participantId) {
          return socket.emit('error_event', {
            success: false,
            error: 'roomCode and participantId are required for audio_chunk',
          });
        }

        // Validate room and participant
        const participant = roomService.validateParticipant(roomCode, participantId);
        if (!participant) {
          return socket.emit('error_event', {
            success: false,
            error: 'Invalid room or participant for audio_chunk',
          });
        }

        if (!data.audio) {
          return socket.emit('error_event', {
            success: false,
            error: 'Audio data is required',
          });
        }

        // Send to audio service (which bridges to AI/STT)
        audioService.processAudioChunk(
          {
            roomCode,
            participantId,
            participantName: participant.name,
            audio: data.audio,
            timestamp: data.timestamp || Date.now(),
          },
          // Callback when AI returns results
          (result) => {
            handleTranscriptResult(io, roomCode, result);
          }
        );
      } catch (err) {
        console.error('[SOCKET] audio_chunk error:', err.message || err);
        socket.emit('error_event', { success: false, error: 'Failed to process audio chunk' });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // DISCONNECT
    // ──────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Disconnected: ${socket.id} (reason: ${reason})`);

      if (currentRoomCode && currentParticipantId) {
        handleParticipantLeave(io, socket, currentRoomCode, currentParticipantId, true);
      } else {
        // Fallback: search by socket ID
        const found = roomService.findParticipantBySocketId(socket.id);
        if (found) {
          handleParticipantLeave(io, socket, found.roomCode, found.participant.id, true);
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // OVERLAP DETECTED — called from audioService / AI layer
  // ────────────────────────────────────────────────────────────────
  audioService.onOverlapDetected((overlapData) => {
    const { roomCode } = overlapData;
    if (roomCode) {
      io.to(roomCode).emit('overlap_detected', overlapData);
      console.log(`[OVERLAP] Overlap detected in room ${roomCode}`);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// HELPER: handle participant leaving / disconnecting
// ══════════════════════════════════════════════════════════════════
function handleParticipantLeave(io, socket, roomCode, participantId, isDisconnect) {
  try {
    if (isDisconnect) {
      // Temporary disconnect — mark as disconnected but keep in room
      // This supports reconnection / session continuity
      roomService.updateParticipantStatus(roomCode, participantId, 'disconnected');
      roomService.unbindSocket(roomCode, participantId);

      // Notify the room
      io.to(roomCode).emit('connection_status', {
        participantId,
        status: 'disconnected',
      });

      console.log(`[SOCKET] Participant ${participantId} disconnected from room ${roomCode}`);
    } else {
      // Explicit leave — remove from room
      const removed = roomService.removeParticipant(roomCode, participantId);
      if (removed) {
        socket.leave(roomCode);

        socket.to(roomCode).emit('participant_left', {
          id: removed.id,
          name: removed.name,
        });

        io.to(roomCode).emit('connection_status', {
          participantId: removed.id,
          status: 'disconnected',
        });

        console.log(`[SOCKET] ${removed.name} (${participantId}) left room ${roomCode}`);
      }
    }
  } catch (err) {
    console.error('[SOCKET] handleParticipantLeave error:', err.message || err);
  }
}

// ══════════════════════════════════════════════════════════════════
// HELPER: handle transcript results from AI/STT
// ══════════════════════════════════════════════════════════════════
function handleTranscriptResult(io, roomCode, result) {
  if (!result || !roomCode) return;

  const transcriptPayload = {
    roomCode: result.roomCode || roomCode,
    participantId: result.participantId,
    speakerName: result.speakerName,
    text: result.text,
    timestamp: result.timestamp,
    isFinal: result.isFinal,
  };

  if (result.isFinal) {
    // Store in room transcripts
    roomService.addTranscript(roomCode, transcriptPayload);
    // Broadcast final transcript
    io.to(roomCode).emit('transcript_final', transcriptPayload);
    console.log(`[TRANSCRIPT] Final in ${roomCode}: "${result.text}" — ${result.speakerName}`);
  } else {
    // Broadcast interim transcript
    io.to(roomCode).emit('transcript_interim', transcriptPayload);
  }
}

module.exports = { initializeSocketHandlers };
