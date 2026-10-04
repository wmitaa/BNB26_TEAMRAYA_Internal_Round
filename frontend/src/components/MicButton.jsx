const LABELS = {
  prompt: ['🎤', 'Start Conversation', 'Click to allow microphone and start'],
  ready: ['🎤', 'Start Conversation', 'Click to start speaking'],
  on: ['⏹', 'Stop Conversation', 'Listening... click to stop'],
  muted: ['🎤', 'Start Conversation', 'Click to start speaking'],
  denied: ['🚫', 'Microphone blocked', 'Allow access in your browser settings'],
  unavailable: ['🚫', 'No microphone found', 'Connect a microphone and try again'],
};

export default function MicButton({ status, onClick }) {
  const [icon, label, hint] = LABELS[status] || LABELS.ready;
  const disabled = status === 'unavailable';
  return (
    <div className="mic">
      <button
        className={`mic-btn mic-${status}`}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={status === 'on'}
        aria-label={`${label}. ${hint}`}
      >
        <span aria-hidden="true">{icon}</span>{label}
      </button>
      <span className={`mic-hint ${status === 'denied' || status === 'unavailable' ? 'bad' : ''}`}>{hint}</span>
    </div>
  );
}
