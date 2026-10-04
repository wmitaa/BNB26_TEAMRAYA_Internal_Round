import { useState, useCallback, useRef, useMemo } from 'react';
import useSocket from './useSocket.js';
import { loadSession } from '../services/api.js';
import { normalizeParticipant, normalizeTranscript, toMessage } from '../utils/normalize.js';
import { isMock } from '../utils/config.js';

const NO_OVERLAP = { active: false, speakers: [] };
// Single source of room state. Starts EMPTY; all data arrives via socket events
// (mock or real). A 'snapshot' replaces everything, so sources can never be mixed or duplicated.
export default function useConversation(mic) {
  const [session] = useState(loadSession);
  const meId = session?.participantId;
  const colors = useRef(new Map());
  // Real mode: start with just this user; other speakers are added as transcript:new arrives. Mock mode: filled by snapshot.
  const [rawParticipants, setParticipants] = useState(() => (!isMock && session
    ? [normalizeParticipant({ id: session.participantId, name: session.participantName }, colors.current)] : []));
  const [transcript, setTranscript] = useState([]);
  const [overlap, setOverlap] = useState(NO_OVERLAP);
  const [audioQuality, setAudio] = useState({ status: 'good' });
  const [notices, setNotices] = useState([]);
  const ids = useRef(new Set(!isMock && session ? [session.participantId] : []));
  const wasLost = useRef(false);
  const norm = (p) => normalizeParticipant(p, colors.current);

  const overlapTimer = useRef(null);

  const notify = useCallback((text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setNotices((n) => [...n.slice(-2), { id, text, tone }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 4000);
  }, []);
  const patch = (p) => setParticipants((l) => l.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  const replaceParticipants = (list) => { const n = list.map(norm); ids.current = new Set(n.map((p) => p.id)); setParticipants(n); };

  const { status, reconnect } = useSocket(session, {
    snapshot: (s) => {
      replaceParticipants(s.participants || []);
      setTranscript((s.transcript || []).map(normalizeTranscript));
      setOverlap(s.overlap || NO_OVERLAP);
      setAudio(s.audio || { status: 'good' });
    },
    'transcript:new': (w) => {
      const m = toMessage(w);
      if (!ids.current.has(m.speakerId)) {
        ids.current.add(m.speakerId);
        setParticipants((l) => [...l, norm({ id: m.speakerId, name: w.speakerName || 'Speaker' })]);
      }
      if (!isMock) patch({ id: m.speakerId, speaking: !w.isFinal });
      setTranscript((t) => {
        const i = t.findIndex((x) => x.id === m.id);
        if (i < 0) return [...t, normalizeTranscript(m)];
        const c = [...t]; const prev = c[i];
        c[i] = { ...prev, ...m, status: m.status === 'final' ? 'final' : prev.status === 'final' ? 'final' : 'updating' };
        return c;
      });
    },
    speaker: patch,
    participants: (p) => {
      if (Array.isArray(p)) return replaceParticipants(p);
      if (ids.current.has(p.id)) { patch(p); if (p.connected === false) notify(`${p.name || 'A participant'} left the conversation.`); return; }
      const n = norm(p); ids.current.add(n.id); setParticipants((l) => [...l, n]); notify(`${n.name} joined the conversation.`);
    },
    overlap: (data) => {
      if (!data) return;
      const speakers = data.speakers || data.participantIds || [];
      const active = Boolean(data.active && speakers.length > 1);
      setOverlap({ active, speakers });
      if (active) {
        notify('Multiple speakers detected.', 'warn');
        if (overlapTimer.current) clearTimeout(overlapTimer.current);
        overlapTimer.current = setTimeout(() => {
          setOverlap(NO_OVERLAP);
        }, 4000);
      }
    },
    audio: setAudio,
    notice: (n) => notify(n.text, n.tone),
    status: (s) => {
      if (s === 'reconnecting') {
        wasLost.current = true;
        notify('Connection lost. Reconnecting...', 'warn');
        if (mic && mic.active && typeof mic.stop === 'function') {
          mic.stop();
          notify('Microphone paused due to connection loss. Click Start to resume.', 'warn');
        }
      }
      if (s === 'disconnected') {
        wasLost.current = true;
        if (mic && mic.active && typeof mic.stop === 'function') {
          mic.stop();
          notify('Microphone paused due to disconnection.', 'warn');
        }
      }
      if (s === 'connected' && wasLost.current) {
        wasLost.current = false;
        notify('Connection restored.', 'ok');
      }
    },
  });

  // Local microphone state is authoritative for this user's own card.
  const micMuted = mic.status !== 'on';
  const participants = useMemo(() => rawParticipants.map((p) => (p.id === meId ? { ...p, muted: micMuted } : p)), [rawParticipants, meId, micMuted]);

  return { session, participants, connectedCount: participants.filter((p) => p.connected).length, transcript, overlap, audioQuality, notices, status, reconnect };
}
