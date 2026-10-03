/**
 * Audio Service
 *
 * Bridge between the backend realtime layer and Mitali's AI/STT layer.
 *
 * When Mitali's AI code is ready, replace the mock adapter with a real
 * import of the AI module. The interface stays the same.
 *
 * ┌────────────┐      ┌──────────────┐      ┌──────────────┐
 * │ Socket.IO  │ ───► │ audioService │ ───► │  AI / STT    │
 * │  handler   │ ◄─── │  (this file) │ ◄─── │  (Mitali)    │
 * └────────────┘      └──────────────┘      └──────────────┘
 */

// ── Overlap listener ───────────────────────────────────────────────
let overlapCallback = null;

/**
 * Register a callback to be invoked when the AI layer detects overlap.
 * The socketHandler calls this once at startup.
 *
 * @param {Function} cb — called with { roomCode, participants, timestamp }
 */
function onOverlapDetected(cb) {
  overlapCallback = cb;
}

/**
 * Called by the AI layer (or the mock) to report an overlap event.
 */
function emitOverlap(data) {
  if (overlapCallback) overlapCallback(data);
}

// ── AI Adapter (mock / real) ───────────────────────────────────────
// Try loading Mitali's AI module. If it's not available yet, fall back
// to the built-in mock adapter so the backend can be tested standalone.

let aiAdapter = null;

try {
  // Attempt to load the real AI integration.
  // Mitali's module should export: processAudio(chunk) → Promise<result>
  // The path assumes the project root layout: ai/index.js
  aiAdapter = require('../../../ai/index');
  console.log('[AUDIO] Real AI/STT adapter loaded');
} catch (_err) {
  // AI module not available — use mock
  console.log('[AUDIO] AI module not found — using mock adapter');
  aiAdapter = null;
}

// ── Mock STT ───────────────────────────────────────────────────────
function mockSpeechToText(chunk) {
  const phrases = [
    'Let\'s discuss our solution.',
    'I think we should focus on the architecture.',
    'Good point, let me add that.',
    'Can you elaborate on that?',
    'We need to handle edge cases.',
    'The demo is looking great!',
    'Let\'s make sure the latency is low.',
    'I agree with that approach.',
  ];

  const text = phrases[Math.floor(Math.random() * phrases.length)];

  return {
    roomCode: chunk.roomCode,
    participantId: chunk.participantId,
    speakerName: chunk.participantName,
    text,
    timestamp: chunk.timestamp || Date.now(),
    isFinal: true,
  };
}

// ── Process Audio Chunk ────────────────────────────────────────────
/**
 * Receives an audio chunk from the socket handler and routes it to the
 * AI/STT layer. When a result comes back, invokes the onResult callback.
 *
 * @param {Object} chunk
 *   - roomCode       {string}
 *   - participantId  {string}
 *   - participantName{string}
 *   - audio          {Buffer|ArrayBuffer|string}  raw audio data
 *   - timestamp      {number}
 *
 * @param {Function} onResult — called with the transcript result object
 */
async function processAudioChunk(chunk, onResult) {
  try {
    let result;

    if (aiAdapter && typeof aiAdapter.processAudio === 'function') {
      // ── Real AI adapter ──────────────────────────────────────────
      result = await aiAdapter.processAudio({
        roomCode: chunk.roomCode,
        participantId: chunk.participantId,
        audio: chunk.audio,
        timestamp: chunk.timestamp,
      });
    } else {
      // ── Mock adapter ─────────────────────────────────────────────
      // Simulate ~200ms STT processing time
      await new Promise((resolve) => setTimeout(resolve, 200));
      result = mockSpeechToText(chunk);
    }

    if (result && onResult) {
      onResult(result);
    }

    // If the AI layer also reports overlaps, handle them
    if (result && result.overlap) {
      emitOverlap({
        roomCode: chunk.roomCode,
        participants: result.overlap.participants || [],
        timestamp: result.overlap.timestamp || Date.now(),
      });
    }
  } catch (err) {
    console.error('[AUDIO] processAudioChunk error:', err.message || err);
    // Don't crash — the stream continues
  }
}

module.exports = {
  processAudioChunk,
  onOverlapDetected,
  emitOverlap,
};
