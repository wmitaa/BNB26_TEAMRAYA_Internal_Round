import { useEffect, useRef } from 'react';
import TranscriptMessage from './TranscriptMessage.jsx';
import SpeakerBadge from './SpeakerBadge.jsx';
export default function LiveTranscript({ messages, participants, overlap }) {
  const end = useRef(null);
  const by = (id) => participants.find((p) => p.id === id);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  return (
    <section className="transcript" aria-label="Live transcript">
      <div className="transcript-head"><span className="live"><i />LIVE</span><span>Participant-aware speaker attribution</span></div>
      {overlap.active && (
        <div className="overlap-banner" role="alert">
          <strong>⚠ {overlap.speakers.length} speakers detected simultaneously</strong>
          <span>{overlap.speakers.map((id) => <SpeakerBadge key={id} participant={by(id)} />)}</span>
        </div>
      )}
      <div className="transcript-list" aria-live="polite">
        {messages.length === 0 && <p className="empty">Captions will appear here as soon as someone speaks.</p>}
        {messages.map((m, i) => (
          <TranscriptMessage key={m.id} message={m} speaker={by(m.speakerId)} latest={i === messages.length - 1}
            overlapping={overlap.active && overlap.speakers.includes(m.speakerId) && m.status !== 'final'} />
        ))}
        <div ref={end} />
      </div>
    </section>
  );
}
