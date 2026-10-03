// Shared helpers that shape data from ANY source (mock or backend) into what the UI expects.
import { formatTime } from './formatTime.js';
export const COLORS = { green: '#15803d', blue: '#1d4ed8', orange: '#c2410c', purple: '#7e22ce', pink: '#be185d', teal: '#0f766e' };
const names = Object.keys(COLORS);
export const colorFor = (i) => names[i % names.length];

// `assigned` is a Map(id -> color) so backend participants without a color keep a stable color.
export function normalizeParticipant(p, assigned) {
  if (!p.color && !assigned.has(p.id)) assigned.set(p.id, colorFor(assigned.size));
  return { connected: true, muted: false, speaking: false, ...p, color: p.color || assigned.get(p.id) };
}
export const normalizeTranscript = (m) => ({ timestamp: formatTime(), status: 'final', ...m });

// Maps the backend `transcript:new` payload to the message shape the transcript components use.
const toTime = (ts) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? formatTime() : formatTime(d); };
export const toMessage = (w) => ({
  id: w.transcriptId,
  speakerId: w.speakerId ?? 'unknown',
  text: w.text,
  timestamp: toTime(w.timestamp),
  status: w.isFinal ? 'final' : 'interim',
  confidence: w.confidence == null ? undefined : w.confidence > 1 ? w.confidence / 100 : w.confidence,
});
