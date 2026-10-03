import SpeakerBadge from './SpeakerBadge.jsx';
import { COLORS } from '../utils/normalize.js';
export default function ParticipantCard({ participant: p, isMe }) {
  const state = !p.connected ? 'Reconnecting' : p.muted ? 'Muted' : 'Connected';
  const speaking = p.connected && p.speaking && !p.muted;
  return (
    <li className={`pcard ${speaking ? 'is-speaking' : ''}`} style={{ '--c': COLORS[p.color] }}>
      <SpeakerBadge participant={p} avatar />
      <div className="pcard-body">
        <strong>{p.name}{isMe && <span className="you"> (you)</span>}</strong>
        <span className={`pstate ${p.connected ? '' : 'warn'}`}>{p.connected ? '● ' : '↻ '}{state}</span>
      </div>
      {speaking
        ? <span className="speak" aria-label={`${p.name} is speaking`}><i /><i /><i /><b>Speaking</b></span>
        : <span className="mic-state" aria-label={p.muted ? 'Microphone muted' : 'Microphone on'}>{p.muted ? '🔇' : '🎤'}</span>}
    </li>
  );
}
