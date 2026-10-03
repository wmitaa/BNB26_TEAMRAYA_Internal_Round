/**
 * Speaker Attribution Module
 * ==========================
 * Provides device/participant-based speaker identification for incoming audio and transcripts.
 *
 * WHY DEVICE-BASED ATTRIBUTION IS USED:
 * ------------------------------------
 * In the Roundtable group conversation model, multiple nearby participants each connect
 * from their own device (laptop, smartphone, tablet).
 *
 * Each device establishes a discrete real-time session tagged with a `participantId`.
 * By mapping speech directly from the device/participant stream:
 * 1. Attribution is deterministic and instantly reliable (0ms computational overhead).
 * 2. It avoids the latency, heavy GPU/CPU compute, and training requirements of
 *    acoustic voice biometric diarization models.
 * 3. It directly aligns with the hackathon MVP goal: low-latency live captions with
 *    clear speaker tags.
 */

/**
 * Normalizes and resolves speaker attribution from participant identity metadata.
 *
 * @param {Object} identity
 * @param {string} identity.participantId - Unique participant/device identifier from backend
 * @param {string} [identity.participantName] - Display name (e.g. "Mitali")
 * @param {Map<string, string>|null} [nameLookupMap] - Optional map of participantId -> name
 * @returns {{ speakerId: string, speakerName: string }}
 */
function attributeSpeaker(identity, nameLookupMap = null) {
  if (!identity || typeof identity !== 'object') {
    throw new Error('Speaker attribution error: Missing identity object');
  }

  const participantId = identity.participantId || identity.speakerId;
  if (!participantId || typeof participantId !== 'string' || !participantId.trim()) {
    throw new Error('Speaker attribution error: Missing required "participantId"');
  }

  const cleanId = participantId.trim();

  // 1. Check explicit name in identity payload
  if (typeof identity.participantName === 'string' && identity.participantName.trim()) {
    return {
      speakerId: cleanId,
      speakerName: identity.participantName.trim()
    };
  }

  // 2. Check registry lookup if available
  if (nameLookupMap && typeof nameLookupMap.get === 'function') {
    const registeredName = nameLookupMap.get(cleanId);
    if (registeredName && typeof registeredName === 'string' && registeredName.trim()) {
      return {
        speakerId: cleanId,
        speakerName: registeredName.trim()
      };
    }
  }

  // 3. Fallback to readable default based on participantId
  const shortId = cleanId.length > 4 ? cleanId.slice(-4) : cleanId;
  return {
    speakerId: cleanId,
    speakerName: `Speaker ${shortId}`
  };
}

/**
 * SpeakerAttributionService
 * -------------------------
 * Manages participant name registrations per room and performs speaker attribution.
 */
class SpeakerAttributionService {
  constructor() {
    // Map<roomId, Map<participantId, participantName>>
    this.rooms = new Map();
  }

  /**
   * Registers or updates a participant's display name in a room.
   * @param {string} roomId
   * @param {string} participantId
   * @param {string} participantName
   */
  registerParticipant(roomId, participantId, participantName) {
    if (!roomId || !participantId) return;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const roomParticipants = this.rooms.get(roomId);
    if (participantName && typeof participantName === 'string') {
      roomParticipants.set(participantId.trim(), participantName.trim());
    }
  }

  /**
   * Retrieves registered name for a participant in a room.
   * @param {string} roomId
   * @param {string} participantId
   * @returns {string|undefined}
   */
  getParticipantName(roomId, participantId) {
    if (!roomId || !participantId) return undefined;
    const roomParticipants = this.rooms.get(roomId);
    return roomParticipants ? roomParticipants.get(participantId.trim()) : undefined;
  }

  /**
   * Removes a participant from a room registry (e.g. on leave/disconnect).
   * @param {string} roomId
   * @param {string} participantId
   */
  removeParticipant(roomId, participantId) {
    if (!roomId || !participantId) return;
    const roomParticipants = this.rooms.get(roomId);
    if (roomParticipants) {
      roomParticipants.delete(participantId.trim());
      if (roomParticipants.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  /**
   * Clears all participant registrations for a room.
   * @param {string} roomId
   */
  clearRoom(roomId) {
    if (roomId) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * Resolves speaker attribution for an incoming audio chunk or event.
   *
   * @param {Object} event
   * @param {string} event.roomId
   * @param {string} event.participantId
   * @param {string} [event.participantName]
   * @returns {{ speakerId: string, speakerName: string }}
   */
  attribute(event) {
    const roomMap = event && event.roomId ? this.rooms.get(event.roomId) : null;
    return attributeSpeaker(event, roomMap);
  }
}

module.exports = {
  attributeSpeaker,
  SpeakerAttributionService
};
