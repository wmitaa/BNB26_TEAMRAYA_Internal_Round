/**
 * Speech-to-Text (STT) Module
 * ============================
 * Provides a provider-agnostic interface for speech-to-text transcription.
 *
 * AUDIO INPUT CONTRACT:
 * ---------------------
 * Any audio chunk sent to this layer should conform to:
 * {
 *   roomId: string,                      // Required: Active room identifier
 *   participantId: string,               // Required: Participant/device sending the audio
 *   participantName: string,             // Optional: Display name of the participant
 *   audioData: Buffer|Uint8Array|string, // Required: Raw binary audio chunk or base64 string
 *   mimeType: string,                    // Optional: e.g. 'audio/webm', 'audio/wav', 'audio/pcm' (default: 'audio/webm')
 *   sampleRate: number,                  // Optional: Audio sample rate in Hz (default: 16000)
 *   timestamp: number|string,            // Optional: Timestamp when captured (epoch ms or ISO string)
 *   isFinal: boolean,                    // Optional: Whether this chunk completes an utterance (default: true)
 *   mockText: string                     // Optional: Simulated transcript text for testing
 * }
 *
 * PLUG-IN POINT FOR REAL STT PROVIDER:
 * ------------------------------------
 * When a real STT provider (e.g., Deepgram, Whisper, Google Cloud Speech, AssemblyAI)
 * is selected:
 * 1. Create a provider class that extends `BaseSpeechToTextProvider`.
 * 2. Implement `async transcribeChunk(audioChunk)`.
 * 3. Pass that provider instance to `SpeechToTextService` or call `service.setProvider(new RealProvider())`.
 * The rest of the pipeline remains completely unchanged.
 */

/**
 * Validates the required fields of an incoming audio chunk.
 * @param {Object} audioChunk
 * @throws {Error} if required fields are missing
 */
function validateAudioChunk(audioChunk) {
  if (!audioChunk || typeof audioChunk !== 'object') {
    throw new Error('Invalid audio chunk: Expected a non-null object');
  }
  if (!audioChunk.roomId || typeof audioChunk.roomId !== 'string' || !audioChunk.roomId.trim()) {
    throw new Error('Invalid audio chunk: Missing required string field "roomId"');
  }
  if (!audioChunk.participantId || typeof audioChunk.participantId !== 'string' || !audioChunk.participantId.trim()) {
    throw new Error('Invalid audio chunk: Missing required string field "participantId"');
  }
  if (audioChunk.audioData === undefined || audioChunk.audioData === null) {
    throw new Error('Invalid audio chunk: Missing required field "audioData"');
  }
}

/**
 * Base abstract class for STT providers.
 * All real and mock providers must implement `transcribeChunk`.
 */
class BaseSpeechToTextProvider {
  /**
   * @param {Object} audioChunk - Audio input satisfying the audio input contract
   * @returns {Promise<{ text: string, isFinal: boolean, confidence: number }>}
   */
  async transcribeChunk(audioChunk) {
    throw new Error('transcribeChunk() must be implemented by the STT provider');
  }
}

/**
 * MockSpeechToTextProvider
 * ------------------------
 * A lightweight mock provider for development and end-to-end testing without external API keys.
 *
 * IMPORTANT NOTE:
 * This mock does NOT perform real acoustic speech recognition.
 * It provides a deterministic simulation so frontend and backend can test the
 * live captioning pipeline end-to-end immediately.
 */
class MockSpeechToTextProvider extends BaseSpeechToTextProvider {
  constructor(options = {}) {
    super();
    this.name = 'MockSTT';
    this.defaultConfidence = typeof options.defaultConfidence === 'number' ? options.defaultConfidence : 0.95;
  }

  /**
   * Simulates transcribing an audio chunk.
   * If `audioChunk.mockText` is supplied, that text is used (useful for integration tests).
   * Otherwise, returns a simulated caption string.
   *
   * @param {Object} audioChunk
   * @returns {Promise<{ text: string, isFinal: boolean, confidence: number }>}
   */
  async transcribeChunk(audioChunk) {
    validateAudioChunk(audioChunk);

    const text = typeof audioChunk.mockText === 'string' && audioChunk.mockText.trim()
      ? audioChunk.mockText.trim()
      : `[Simulated live caption for participant ${audioChunk.participantId}]`;

    return {
      text,
      isFinal: Boolean(audioChunk.isFinal ?? true),
      confidence: this.defaultConfidence
    };
  }
}

/**
 * SpeechToTextService
 * -------------------
 * High-level service managing the active STT provider.
 */
class SpeechToTextService {
  /**
   * @param {BaseSpeechToTextProvider} [provider] - Defaults to MockSpeechToTextProvider
   */
  constructor(provider = new MockSpeechToTextProvider()) {
    this.provider = provider;
  }

  /**
   * Swap out the active STT provider (e.g. when plugging in a real provider).
   * @param {BaseSpeechToTextProvider} provider
   */
  setProvider(provider) {
    if (!provider || typeof provider.transcribeChunk !== 'function') {
      throw new Error('Invalid STT provider: Must implement transcribeChunk()');
    }
    this.provider = provider;
  }

  /**
   * Transcribes an incoming audio chunk using the active provider.
   * @param {Object} audioChunk
   * @returns {Promise<{ text: string, isFinal: boolean, confidence: number }>}
   */
  async transcribe(audioChunk) {
    return this.provider.transcribeChunk(audioChunk);
  }
}

module.exports = {
  validateAudioChunk,
  BaseSpeechToTextProvider,
  MockSpeechToTextProvider,
  SpeechToTextService
};
