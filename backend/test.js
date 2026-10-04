/**
 * Comprehensive Socket.IO + REST Integration Test
 * Tests: room creation, joining, socket events, audio chunks,
 *        transcripts, room isolation, disconnect/reconnect, overlap
 */

const io = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';

// Helper: HTTP request using node fetch (Node 18+)
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  return res.json();
}

// Helper: connect a socket and return a promise-based wrapper
function connectSocket() {
  return new Promise((resolve) => {
    const socket = io(BASE_URL, { transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
  });
}

// Helper: wait for a specific event
function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Helper: emit with acknowledgement
function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => resolve(response));
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  ROUNDTABLE BACKEND — INTEGRATION TESTS');
  console.log('══════════════════════════════════════════════\n');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 1: REST API
  // ══════════════════════════════════════════════════════════════
  console.log('── REST API Tests ──────────────────────────\n');

  // 1a. Create room
  const createRes = await api('POST', '/api/rooms', { name: 'Anushka' });
  assert(createRes.success === true, 'Create room returns success');
  assert(createRes.roomCode && createRes.roomCode.startsWith('ROUND-'), 'Room code format is ROUND-####');
  assert(createRes.participant.name === 'Anushka', 'Creator name preserved');
  assert(createRes.participant.id, 'Creator has an ID');

  const roomCode = createRes.roomCode;
  const anushkaId = createRes.participant.id;

  // 1b. Join room
  const joinRes = await api('POST', `/api/rooms/${roomCode}/join`, { name: 'Mitali' });
  assert(joinRes.success === true, 'Join room returns success');
  assert(joinRes.participant.name === 'Mitali', 'Joiner name preserved');
  assert(joinRes.participants.length === 1, 'Existing participants returned');
  assert(joinRes.participants[0].name === 'Anushka', 'Existing participant is Anushka');

  const mitaliId = joinRes.participant.id;

  // 1c. Third participant
  const join2Res = await api('POST', `/api/rooms/${roomCode}/join`, { name: 'Shrvni' });
  assert(join2Res.success === true, 'Third participant joins');
  assert(join2Res.participants.length === 2, 'Two existing participants returned');

  const shrvniId = join2Res.participant.id;

  // 1d. Get room
  const getRes = await api('GET', `/api/rooms/${roomCode}`);
  assert(getRes.success === true, 'Get room returns success');
  assert(getRes.room.participants.length === 3, 'Room has 3 participants');
  assert(getRes.room.status === 'active', 'Room status is active');

  // 1e. Validation errors
  const noNameRes = await api('POST', '/api/rooms', {});
  assert(noNameRes.success === false, 'Missing name returns error');

  const badRoomRes = await api('POST', '/api/rooms/ROUND-9999/join', { name: 'Test' });
  assert(badRoomRes.success === false, 'Invalid room code returns error');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 2: Socket.IO — Join, Room State, Events
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Socket.IO Tests ─────────────────────────\n');

  // Connect 3 sockets
  const socketAnushka = await connectSocket();
  const socketMitali = await connectSocket();
  const socketShrvni = await connectSocket();

  assert(socketAnushka.connected, 'Anushka socket connected');
  assert(socketMitali.connected, 'Mitali socket connected');
  assert(socketShrvni.connected, 'Shrvni socket connected');

  // 2a. Anushka joins room via socket
  // Set up listeners BEFORE emitting to avoid race conditions
  const anushkaStatePromise = waitForEvent(socketAnushka, 'room_state');

  const joinAck = await emitWithAck(socketAnushka, 'join_room', {
    roomCode,
    participantId: anushkaId,
    name: 'Anushka',
  });
  assert(joinAck.success === true, 'Anushka join_room acknowledged');

  const anushkaState = await anushkaStatePromise;
  assert(anushkaState.roomCode === roomCode, 'Anushka receives room_state with correct room code');
  assert(anushkaState.participants.length >= 1, 'Room state contains participants');

  // 2b. Mitali joins — Anushka should receive participant_joined
  const mitaliJoinedPromise = waitForEvent(socketAnushka, 'participant_joined');

  const joinAck2 = await emitWithAck(socketMitali, 'join_room', {
    roomCode,
    participantId: mitaliId,
    name: 'Mitali',
  });
  assert(joinAck2.success === true, 'Mitali join_room acknowledged');

  const mitaliJoined = await mitaliJoinedPromise;
  assert(mitaliJoined.name === 'Mitali', 'Anushka receives participant_joined for Mitali');
  assert(mitaliJoined.status === 'connected', 'Mitali status is connected');

  // 2c. Shrvni joins
  const shrvniJoinedPromise = waitForEvent(socketAnushka, 'participant_joined');

  await emitWithAck(socketShrvni, 'join_room', {
    roomCode,
    participantId: shrvniId,
    name: 'Shrvni',
  });

  const shrvniJoined = await shrvniJoinedPromise;
  assert(shrvniJoined.name === 'Shrvni', 'Anushka receives participant_joined for Shrvni');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 3: Connection Status
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Connection Status Tests ─────────────────\n');

  // All 3 sockets received connection_status events during join
  // We test by checking room state
  const roomAfterJoin = await api('GET', `/api/rooms/${roomCode}`);
  const connectedCount = roomAfterJoin.room.participants.filter((p) => p.status === 'connected').length;
  assert(connectedCount === 3, 'All 3 participants show connected status');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 4: Audio Chunk + Transcript
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Audio & Transcript Tests ────────────────\n');

  // Mitali and Shrvni listen for transcript_final
  const mitaliTranscriptPromise = waitForEvent(socketMitali, 'transcript_final');
  const shrvniTranscriptPromise = waitForEvent(socketShrvni, 'transcript_final');

  // Anushka sends an audio chunk
  socketAnushka.emit('audio_chunk', {
    roomCode,
    participantId: anushkaId,
    audio: Buffer.from('fake-audio-data'),
    timestamp: Date.now(),
  });

  // Wait for transcript to arrive at other participants
  const mitaliTranscript = await mitaliTranscriptPromise;
  assert(mitaliTranscript.participantId === anushkaId, 'Transcript has correct participantId');
  assert(mitaliTranscript.speakerName === 'Anushka', 'Transcript has correct speakerName');
  assert(typeof mitaliTranscript.text === 'string' && mitaliTranscript.text.length > 0, 'Transcript has text content');
  assert(mitaliTranscript.isFinal === true, 'Transcript is marked final');
  assert(mitaliTranscript.roomCode === roomCode, 'Transcript has correct roomCode');

  const shrvniTranscript = await shrvniTranscriptPromise;
  assert(shrvniTranscript.speakerName === 'Anushka', 'Shrvni also receives same transcript');

  // Verify transcript stored in room
  const roomWithTranscript = await api('GET', `/api/rooms/${roomCode}`);
  assert(roomWithTranscript.room.transcripts.length >= 1, 'Transcript stored in room');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 5: Room Isolation
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Room Isolation Tests ────────────────────\n');

  // Create a second room
  const room2Res = await api('POST', '/api/rooms', { name: 'Alice' });
  const room2Code = room2Res.roomCode;
  const aliceId = room2Res.participant.id;

  const socketAlice = await connectSocket();
  await emitWithAck(socketAlice, 'join_room', {
    roomCode: room2Code,
    participantId: aliceId,
    name: 'Alice',
  });

  // Alice listens for transcript_final — should NOT get Room 1's transcripts
  let aliceGotWrongTranscript = false;
  socketAlice.on('transcript_final', (data) => {
    if (data.roomCode === roomCode) {
      aliceGotWrongTranscript = true;
    }
  });

  // Anushka sends another audio chunk in Room 1
  const mitaliTranscript2Promise = waitForEvent(socketMitali, 'transcript_final');
  socketAnushka.emit('audio_chunk', {
    roomCode,
    participantId: anushkaId,
    audio: Buffer.from('more-fake-audio'),
    timestamp: Date.now(),
  });

  await mitaliTranscript2Promise; // Wait for Room 1 transcript delivery

  // Give Alice a moment to (incorrectly) receive something
  await new Promise((r) => setTimeout(r, 500));
  assert(!aliceGotWrongTranscript, 'Room 2 participant did NOT receive Room 1 transcripts (isolation)');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 6: Leave & Disconnect
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Leave & Disconnect Tests ────────────────\n');

  // Shrvni explicitly leaves
  const leftPromise = waitForEvent(socketAnushka, 'participant_left');
  socketShrvni.emit('leave_room', { roomCode, participantId: shrvniId });
  const leftEvent = await leftPromise;
  assert(leftEvent.name === 'Shrvni', 'participant_left event has correct name');

  // After explicit leave, room should have 2 participants
  const roomAfterLeave = await api('GET', `/api/rooms/${roomCode}`);
  assert(roomAfterLeave.room.participants.length === 2, 'Room has 2 participants after leave');

  // Mitali disconnects (socket close) — should be marked disconnected, not removed
  const disconnectStatusPromise = waitForEvent(socketAnushka, 'connection_status');
  socketMitali.disconnect();
  const disconnectStatus = await disconnectStatusPromise;
  assert(disconnectStatus.participantId === mitaliId, 'Disconnect status for correct participant');
  assert(disconnectStatus.status === 'disconnected', 'Status shows disconnected');

  // Room still has 2 participants (Mitali is disconnected, not removed)
  const roomAfterDisconnect = await api('GET', `/api/rooms/${roomCode}`);
  assert(roomAfterDisconnect.room.participants.length === 2, 'Mitali still in room after disconnect');
  const mitaliInRoom = roomAfterDisconnect.room.participants.find((p) => p.id === mitaliId);
  assert(mitaliInRoom && mitaliInRoom.status === 'disconnected', 'Mitali status is disconnected');

  // ══════════════════════════════════════════════════════════════
  // TEST GROUP 7: Reconnection
  // ══════════════════════════════════════════════════════════════
  console.log('\n── Reconnection Tests ─────────────────────\n');

  // Mitali reconnects with a new socket
  const socketMitaliReconnect = await connectSocket();
  const reconnectStatusPromise = waitForEvent(socketAnushka, 'connection_status');
  const mitaliReconnectStatePromise = waitForEvent(socketMitaliReconnect, 'room_state');

  await emitWithAck(socketMitaliReconnect, 'join_room', {
    roomCode,
    participantId: mitaliId,
    name: 'Mitali',
  });

  const reconnectStatus = await reconnectStatusPromise;
  assert(reconnectStatus.participantId === mitaliId, 'Reconnect status for correct participant');
  assert(reconnectStatus.status === 'connected', 'Status shows connected after reconnect');

  // Mitali should receive room_state with existing transcripts
  const mitaliReconnectState = await mitaliReconnectStatePromise;
  assert(mitaliReconnectState.transcripts.length >= 1, 'Reconnected participant gets existing transcripts');
  assert(mitaliReconnectState.participants.length === 2, 'No duplicate participant created on reconnect');

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════\n');

  // Cleanup
  socketAnushka.disconnect();
  socketMitaliReconnect.disconnect();
  socketShrvni.disconnect();
  socketAlice.disconnect();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
