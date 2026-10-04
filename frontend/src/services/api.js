// API boundary. MOCK branch is used in mock mode; REAL branch calls the backend.
// Expected backend contract (adjust paths here only):
//   POST /rooms                {name}           -> {roomId, roomCode, participantId, participantName}
//   POST /rooms/:roomCode/join {name}           -> {roomId, roomCode, participantId, participantName}
//   POST /rooms/:roomCode/leave {participantId} -> {ok:true}
//   GET  /rooms/:roomCode                       -> {roomCode, status}
// toSession() also accepts {code}/{id}/{participant:{id,name}} variants. Adjust paths/field names HERE only.
import { isMock, MODE, API_URL } from '../utils/config.js';
const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));
export const normalizeCode = (c) => c.trim().toUpperCase();
// Format check is mock-only; in real mode the backend decides whether a code is valid.
export const isValidCode = (c) => (isMock ? /^ROUND-\d{4}$/.test(normalizeCode(c)) : c.trim().length > 0);

const toSession = (r, name) => ({
  roomId: r.roomId ?? r.room?.id ?? r.id ?? r.roomCode ?? r.code,
  roomCode: r.roomCode ?? r.code ?? r.room?.code,
  participantId: r.participantId ?? r.participant?.id,
  participantName: r.participantName ?? r.participant?.name ?? name,
});
async function http(path, body, method = 'POST') {
  const res = await fetch(API_URL + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let msg; try { const data = await res.json(); msg = data.error || data.message; } catch { /* no body */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function createRoom(name) {
  if (!isMock) return toSession(await http('/api/rooms', { name: name.trim() }), name.trim());
  await delay();
  const roomCode = `ROUND-${Math.floor(1000 + Math.random() * 9000)}`;
  return { roomId: `mock-${roomCode}`, roomCode, participantId: 'me', participantName: name.trim() };
}
export async function joinRoom(code, name) {
  if (!isMock) return toSession(await http(`/api/rooms/${encodeURIComponent(normalizeCode(code))}/join`, { name: name.trim() }), name.trim());
  await delay();
  if (!isValidCode(code)) throw new Error('That room code is not valid. Codes look like ROUND-4821.');
  return { roomId: `mock-${normalizeCode(code)}`, roomCode: normalizeCode(code), participantId: 'me', participantName: name.trim() };
}
export async function leaveRoom(session) {
  if (!isMock && session) return http(`/api/rooms/${encodeURIComponent(session.roomCode)}/leave`, { participantId: session.participantId });
  await delay(150); return { ok: true };
}
export async function getRoom(code) {
  if (!isMock) return http(`/api/rooms/${encodeURIComponent(code)}`, null, 'GET');
  await delay(150); return { code, status: 'active' };
}

// Session shape: { roomId, roomCode, participantId, participantName }. Tagged with the data mode. A session from the other mode is ignored, so mock and real never mix.
export const saveSession = (s) => sessionStorage.setItem('roundtable.session', JSON.stringify({ ...s, mode: MODE }));
export const loadSession = () => {
  try { const s = JSON.parse(sessionStorage.getItem('roundtable.session')); return s && s.mode === MODE && s.roomCode && s.participantId ? s : null; } catch { return null; }
};
export const clearSession = () => sessionStorage.removeItem('roundtable.session');
