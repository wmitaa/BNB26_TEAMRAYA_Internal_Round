/**
 * Room Code Generator
 * Produces unique codes in the format: ROUND-####
 */

const { hasRoom } = require('../models/room');

/**
 * Generate a random 4-digit number string (0000–9999).
 */
function randomDigits() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

/**
 * Generate a unique room code that does not collide with active rooms.
 * Format: ROUND-####
 * @returns {string}
 */
function generateRoomCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 100; // safety valve

  do {
    code = `ROUND-${randomDigits()}`;
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate a unique room code. Too many active rooms.');
    }
  } while (hasRoom(code));

  return code;
}

module.exports = { generateRoomCode };
