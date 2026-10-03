/**
 * Speech-to-Text (STT) Module
 * ============================
 * Provides a provider-agnostic interface for speech-to-text transcription,
 * supporting both Mock STT (for testing/offline dev) and Deepgram Live Streaming STT.
 *
 * AUDIO INPUT CONTRACT & FORMATS:
 * -------------------------------
 * Deepgram's streaming STT API supports the following audio formats:
 *
 * 1. WebM / Opus container (`mimeType: 'audio/webm'`):
 *    - Standard output from the browser's `MediaRecorder` API.
 *    - Deepgram automatically detects the container headers.
 *    - Note: The first chunk streamed from the browser must include the WebM container header.
 *
 * 2. Linear16 PCM (`mimeType: 'audio/pcm'` or `'linear16'`):
 *    - Raw uncompressed 16-bit signed integer samples (little-endian), mono, 16000 Hz.
 *    - Standard output from browser `AudioWorkletNode` or Web Audio API.
 *    - When using PCM, encoding and sample_rate parameters are passed to Deepgram:
 *      `encoding=linear16&sample_rate=16000&channels=1`
 *
 * 3. WAV (`mimeType: 'audio/wav'`):
 *    - Standard headered RIFF WAV audio chunks.
 *
 * Audio Chunk Input Shape:
 * {
 *   roomId: string,                      // Required: Room identifier
 *   participantId: string,               // Required: Participant/device identifier
 *   participantName: string,             // Optional: Display name (e.g. "Mitali")
 *   audioData: Buffer|Uint8Array|string, // Required: Raw binary audio chunk or base64 string
 *   mimeType: string,                    // Optional: 'audio/webm', 'audio/pcm', 'audio/wav' (default: 'audio/webm')
 *   sampleRate: number,                  // Optional: Sample rate in Hz (default: 16000)
 *   timestamp: number|string,            // Optional: Capture timestamp
 *   isFinal: boolean,                    // Optional: Whether this closes an utterance (default: true)
 *   mockText: string                     // Optional: Simulated transcript text for testing
 * }
 *
 * SECURITY:
 * ---------
 * The Deepgram API key is read strictly from `process.env.DEEPGRAM_API_KEY` on the server.
 * It is NEVER exposed to the client or browser, and NEVER printed or logged.
 */

const crypto = require('crypto');

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
 * All providers (Mock, Deepgram, etc.) implement `transcribeChunk`.
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
 * NOTE: This mock does NOT perform real acoustic speech recognition.
 * It provides a deterministic simulation for local development and tests.
 */
class MockSpeechToTextProvider extends BaseSpeechToTextProvider {
  constructor(options = {}) {
    super();
    this.name = 'MockSTT';
    this.defaultConfidence = typeof options.defaultConfidence === 'number' ? options.defaultConfidence : 0.95;
  }

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
 * DeepgramSpeechToTextProvider
 * ----------------------------
 * Real-time streaming Speech-to-Text provider powered by Deepgram's live WebSocket API.
 *
 * Features:
 * - Real-time bidirectional streaming over WebSocket (wss://api.deepgram.com/v1/listen)
 * - Interim (live preview) and Final transcription results
 * - Participant/device-based speaker attribution mapping
 * - Standardized transcript results adhering to the Roundtable Transcript Contract
 * - Zero external library dependency: utilizes standard Node.js WebSocket support
 */
class DeepgramSpeechToTextProvider extends BaseSpeechToTextProvider {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey] - Optional explicit key (defaults to process.env.DEEPGRAM_API_KEY)
   * @param {string} [options.model='nova-3'] - Deepgram model ('nova-3', 'nova-2')
   * @param {string} [options.language='en'] - Transcription language code
   * @param {boolean} [options.smartFormat=true] - Applies punctuation, numbers, formatting
   * @param {boolean} [options.interimResults=true] - Emits interim partial transcripts
   * @param {string} [options.endpoint='wss://api.deepgram.com/v1/listen'] - WebSocket endpoint
   * @param {boolean} [options.skipKeyCheck=false] - For offline testing without API key
   */
  constructor(options = {}) {
    super();
    this.name = 'DeepgramSTT';
    this.options = {
      model: options.model || 'nova-3',
      language: options.language || 'en',
      smartFormat: options.smartFormat ?? true,
      interimResults: options.interimResults ?? true,
      endpoint: options.endpoint || 'wss://api.deepgram.com/v1/listen',
      ...options
    };

    this.explicitApiKey = options.apiKey;
    this.skipKeyCheck = Boolean(options.skipKeyCheck);

    // Validate key on initialization unless explicitly skipped for offline testing
    if (!this.skipKeyCheck) {
      this.getApiKey();
    }

    // Active streaming sessions: Map<`${roomId}:${participantId}`, StreamSession>
    this.streams = new Map();

    // Event listeners
    this.transcriptListeners = new Set();
    this.errorListeners = new Set();
    this.closeListeners = new Set();
  }

  /**
   * Securely retrieves the Deepgram API key.
   * NEVER logs or displays the key.
   * @returns {string} API key
   * @throws {Error} if DEEPGRAM_API_KEY is not defined
   */
  getApiKey() {
    const key = this.explicitApiKey || process.env.DEEPGRAM_API_KEY;
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new Error(
        'Deepgram STT configuration error: DEEPGRAM_API_KEY environment variable is required but not set. ' +
        'Please define DEEPGRAM_API_KEY in your environment or .env file.'
      );
    }
    return key.trim();
  }

  /**
   * Constructs the Deepgram live streaming WebSocket URL based on audio format options.
   * @param {Object} audioChunk
   * @returns {string} URL with query parameters
   */
  buildWebSocketUrl(audioChunk = {}) {
    const params = new URLSearchParams({
      model: this.options.model,
      language: this.options.language,
      smart_format: String(this.options.smartFormat),
      interim_results: String(this.options.interimResults),
      punctuate: 'true'
    });

    const mime = (audioChunk.mimeType || '').toLowerCase();
    if (mime.includes('pcm') || mime.includes('linear16') || mime.includes('raw')) {
      params.set('encoding', 'linear16');
      params.set('sample_rate', String(audioChunk.sampleRate || 16000));
      params.set('channels', '1');
    } else if (mime.includes('opus')) {
      params.set('encoding', 'opus');
    }

    return `${this.options.endpoint}?${params.toString()}`;
  }

  /**
   * Maps a Deepgram live transcription response to the Roundtable Transcript Contract.
   *
   * @param {Object} data - Raw Deepgram JSON message
   * @param {Object} context - Metadata context { roomId, participantId, participantName }
   * @returns {Object|null} Standardized transcript result, or null if empty/silent
   */
  mapDeepgramResponse(data, context = {}) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Only process "Results" type messages containing alternative transcriptions
    if (data.type !== 'Results' && !data.channel) {
      return null;
    }

    const alternative = data.channel?.alternatives?.[0];
    if (!alternative || typeof alternative.transcript !== 'string') {
      return null;
    }

    const text = alternative.transcript.trim();
    // Do not emit empty transcript messages (Requirement 7)
    if (!text) {
      return null;
    }

    // Determine finality: Deepgram sets is_final or speech_final
    const isFinal = Boolean(data.is_final || data.speech_final);
    const confidence = typeof alternative.confidence === 'number'
      ? Math.max(0, Math.min(1, alternative.confidence))
      : 1.0;

    const participantId = (context.participantId || 'unknown').trim();
    const shortId = participantId.length > 4 ? participantId.slice(-4) : participantId;
    const speakerName = (context.participantName && context.participantName.trim())
      ? context.participantName.trim()
      : `Speaker ${shortId}`;

    return {
      transcriptId: data.metadata?.request_id || crypto.randomUUID(),
      roomId: context.roomId || 'unknown',
      speakerId: participantId,
      speakerName: speakerName,
      text: text,
      timestamp: new Date().toISOString(),
      isFinal: isFinal,
      confidence: confidence
    };
  }

  /**
   * Retrieves or establishes an active streaming WebSocket connection to Deepgram
   * for a given participant in a room.
   *
   * @param {Object} context - { roomId, participantId, participantName, mimeType, sampleRate }
   * @returns {Object} Stream session object
   */
  getOrCreateStream(context) {
    const streamKey = `${context.roomId}:${context.participantId}`;
    if (this.streams.has(streamKey)) {
      const existing = this.streams.get(streamKey);
      if (existing.ws && existing.ws.readyState === 1 /* OPEN */ || existing.ws.readyState === 0 /* CONNECTING */) {
        return existing;
      }
    }

    const apiKey = this.getApiKey();
    const url = this.buildWebSocketUrl(context);

    const session = {
      streamKey,
      roomId: context.roomId,
      participantId: context.participantId,
      participantName: context.participantName,
      queue: [],
      isOpen: false,
      ws: null
    };

    try {
      // Connect using standard Node.js global WebSocket with Authorization subprotocol/header
      const WSClient = globalThis.WebSocket;
      if (typeof WSClient !== 'function') {
        throw new Error('WebSocket is not available in the current Node.js runtime environment');
      }

      // Deepgram supports authentication via the 'token' subprotocol: ['token', apiKey]
      const ws = new WSClient(url, ['token', apiKey]);
      session.ws = ws;

      ws.onopen = () => {
        session.isOpen = true;
        // Flush any queued audio buffers
        while (session.queue.length > 0) {
          const chunk = session.queue.shift();
          try {
            ws.send(chunk);
          } catch (err) {
            this.handleError(err, session);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
          
          if (data.type === 'Error') {
            const apiError = new Error(`Deepgram API error: ${data.message || 'Unknown error'}`);
            this.handleError(apiError, session);
            return;
          }

          const transcript = this.mapDeepgramResponse(data, {
            roomId: session.roomId,
            participantId: session.participantId,
            participantName: session.participantName
          });

          if (transcript) {
            this.emitTranscript(transcript);
          }
        } catch (err) {
          this.handleError(new Error(`Failed to parse Deepgram message: ${err.message}`), session);
        }
      };

      ws.onerror = (event) => {
        const errorMsg = event.message || (event.error && event.error.message) || 'Deepgram WebSocket connection error';
        this.handleError(new Error(errorMsg), session);
      };

      ws.onclose = (event) => {
        session.isOpen = false;
        this.streams.delete(streamKey);
        for (const listener of this.closeListeners) {
          try {
            listener({ streamKey, code: event.code, reason: event.reason });
          } catch (_) {}
        }
      };

      this.streams.set(streamKey, session);
      return session;
    } catch (err) {
      this.handleError(err, session);
      throw err;
    }
  }

  /**
   * Sends an audio chunk into the active streaming connection.
   * @param {Object} audioChunk - Audio chunk conforming to Audio Input Contract
   */
  sendAudioChunk(audioChunk) {
    validateAudioChunk(audioChunk);
    const session = this.getOrCreateStream(audioChunk);

    let buffer = audioChunk.audioData;
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'base64');
    }

    if (session.isOpen && session.ws && session.ws.readyState === 1 /* OPEN */) {
      session.ws.send(buffer);
    } else {
      // Buffer until connection is open
      session.queue.push(buffer);
    }
  }

  /**
   * BaseSpeechToTextProvider compliance method.
   * Feeds the chunk into the live stream and returns status.
   *
   * @param {Object} audioChunk
   * @returns {Promise<{ text: string, isFinal: boolean, confidence: number }>}
   */
  async transcribeChunk(audioChunk) {
    this.sendAudioChunk(audioChunk);

    return {
      text: `[Streamed chunk for participant ${audioChunk.participantId}]`,
      isFinal: Boolean(audioChunk.isFinal ?? true),
      confidence: 1.0
    };
  }

  /**
   * Registers a callback for incoming transcripts (both interim and final).
   * @param {Function} callback - (transcriptResult) => void
   */
  onTranscript(callback) {
    if (typeof callback === 'function') {
      this.transcriptListeners.add(callback);
    }
    return () => this.transcriptListeners.delete(callback);
  }

  /**
   * Registers a callback for STT / WebSocket errors.
   * @param {Function} callback - (error, session) => void
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.errorListeners.add(callback);
    }
    return () => this.errorListeners.delete(callback);
  }

  /**
   * Registers a callback for WebSocket close events.
   * @param {Function} callback - ({ streamKey, code, reason }) => void
   */
  onClose(callback) {
    if (typeof callback === 'function') {
      this.closeListeners.add(callback);
    }
    return () => this.closeListeners.delete(callback);
  }

  emitTranscript(transcript) {
    for (const listener of this.transcriptListeners) {
      try {
        listener(transcript);
      } catch (err) {
        console.error('Error in onTranscript listener:', err.message);
      }
    }
  }

  handleError(error, session) {
    for (const listener of this.errorListeners) {
      try {
        listener(error, session);
      } catch (_) {}
    }
  }

  /**
   * Closes the active stream for a specific participant in a room.
   * @param {string} roomId
   * @param {string} participantId
   */
  closeStream(roomId, participantId) {
    const streamKey = `${roomId}:${participantId}`;
    const session = this.streams.get(streamKey);
    if (session && session.ws) {
      try {
        if (session.ws.readyState === 1 /* OPEN */) {
          // Send Deepgram close stream frame
          session.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        session.ws.close();
      } catch (_) {}
    }
    this.streams.delete(streamKey);
  }

  /**
   * Closes all active streaming connections.
   */
  closeAllStreams() {
    for (const [key, session] of this.streams.entries()) {
      if (session.ws) {
        try {
          session.ws.close();
        } catch (_) {}
      }
    }
    this.streams.clear();
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
   * Swap out the active STT provider (e.g. switching between Mock and Deepgram).
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
  DeepgramSpeechToTextProvider,
  SpeechToTextService
};
