import SpeakerBadge from './SpeakerBadge.jsx';
import { COLORS } from '../utils/normalize.js';
const STATUS = { interim: 'Interim', updating: 'Updating', final: 'Final' };
export default function TranscriptMessage({ message: m, speaker, latest, overlapping }) {
  const s = m.status || 'final';
  return (
    <article className={`msg msg-${s} ${latest ? 'latest' : ''} ${overlapping ? 'overlap' : ''}`} style={{ '--c': COLORS[speaker?.color] || COLORS.teal }}>
      <div className="msg-meta">
        <time>{m.timestamp}</time>
        <SpeakerBadge participant={speaker} />
        <span className={`chip chip-${s}`}>{STATUS[s]}</span>
        {s === 'final' && m.confidence != null && <span className="conf">{Math.round(m.confidence * 100)}% confidence</span>}
      </div>
      <p>{m.text}{s !== 'final' && <span className="caret" aria-hidden="true" />}</p>
    </article>
  );
}
