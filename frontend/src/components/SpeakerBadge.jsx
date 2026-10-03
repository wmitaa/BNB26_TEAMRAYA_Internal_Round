import { COLORS } from '../utils/normalize.js';
export default function SpeakerBadge({ participant, avatar = false }) {
  const p = participant || { name: 'Unknown speaker', color: 'teal' };
  const style = { '--c': COLORS[p.color] || COLORS.teal };
  return avatar
    ? <span className="avatar" style={style} aria-hidden="true">{p.name[0]}</span>
    : <span className="badge" style={style}><span className="badge-dot" aria-hidden="true" />{p.name}</span>;
}
