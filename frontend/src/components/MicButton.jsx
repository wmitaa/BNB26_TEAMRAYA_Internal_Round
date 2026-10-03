const LABELS = {
  prompt: ['🎤', 'Enable microphone', 'Permission not requested yet'],
  ready: ['🎤', 'Start microphone', 'Permission granted'],
  on: ['🎤', 'Microphone On', 'Tap to mute'],
  muted: ['🔇', 'Muted', 'Tap to unmute'],
  denied: ['🚫', 'Microphone blocked', 'Allow access in your browser settings'],
  unavailable: ['🚫', 'No microphone found', 'Connect a microphone and try again'],
};
export default function MicButton({ status, onClick }) {
  const [icon, label, hint] = LABELS[status];
  const disabled = status === 'unavailable';
  return (
    <div className="mic">
      <button className={`mic-btn mic-${status}`} onClick={onClick} disabled={disabled} aria-pressed={status === 'on'} aria-label={`${label}. ${hint}`}>
        <span aria-hidden="true">{icon}</span>{label}
      </button>
      <span className={`mic-hint ${status === 'denied' || status === 'unavailable' ? 'bad' : ''}`}>{hint}</span>
    </div>
  );
}
