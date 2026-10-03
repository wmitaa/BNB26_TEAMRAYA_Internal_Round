const MAP = {
  connected: ['●', 'Connected'], connecting: ['◌', 'Connecting...'],
  reconnecting: ['↻', 'Reconnecting...'], disconnected: ['○', 'Disconnected'],
};
export default function ConnectionStatus({ status }) {
  const [icon, label] = MAP[status] || MAP.disconnected;
  return <span className={`conn conn-${status}`} role="status"><span className="conn-icon" aria-hidden="true">{icon}</span>{label}</span>;
}
