import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Navbar.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import ParticipantCard from '../components/ParticipantCard.jsx';
import LiveTranscript from '../components/LiveTranscript.jsx';
import MicButton from '../components/MicButton.jsx';
import useConversation from '../hooks/useConversation.js';
import useMicrophone from '../hooks/useMicrophone.js';
import { leaveRoom, clearSession } from '../services/api.js';
import { sendAudioChunk } from '../services/socket.js';

export default function ConversationRoom() {
  const nav = useNavigate();
  const mic = useMicrophone(sendAudioChunk);
  const c = useConversation(mic);
  if (!c.session) return <Navigate to="/join" replace />;

  // Real-time microphone & stream health calculation
  let qLabel = 'Idle';
  let qTone = 'muted';
  let qIcon = '○';
  let qDetail = '';
  let qCondition = '';

  if (mic.active) {
    if (!mic.health) {
      qLabel = 'Checking...';
      qTone = 'warn';
      qIcon = '◌';
      qDetail = 'Measuring stream';
    } else {
      const { status, conditionLabel, dbfs, clippingPercent } = mic.health;
      if (status === 'good') {
        qLabel = 'Good';
        qTone = 'ok';
        qIcon = '●';
      } else if (status === 'fair') {
        qLabel = 'Fair';
        qTone = 'warn';
        qIcon = '▲';
      } else {
        qLabel = 'Poor';
        qTone = 'bad';
        qIcon = '✕';
      }
      qCondition = conditionLabel || 'Audio normal';
      qDetail = `${dbfs} dBFS · ${clippingPercent}% clip`;
    }
  }

  const toggleMic = async () => { await mic.toggle(); };
  async function leave() {
    const roomCode = c.session?.roomCode;
    try { await leaveRoom(c.session); } catch { /* leave anyway */ }
    clearSession();
    if (roomCode) {
      nav(`/summary?room=${encodeURIComponent(roomCode)}`);
    } else {
      nav('/');
    }
  }
  return (
    <div className="room">
      <header className="room-head">
        <Logo />
        <span className="room-code">{c.session.roomCode}</span>
        <ConnectionStatus status={c.status} />
        <span className="muted">{c.connectedCount} Participants</span>
        <button className="btn btn-sm btn-danger" onClick={leave}>Leave Room</button>
      </header>
      <aside className="room-side" aria-label="Participants">
        <h2>In this conversation</h2>
        <p className="muted">{c.connectedCount} devices connected</p>
        <ul className="plist">{c.participants.map((p) => <ParticipantCard key={p.id} participant={p} isMe={p.id === c.session?.participantId || p.id === 'me'} />)}</ul>
      </aside>
      <main className="room-main"><LiveTranscript messages={c.transcript} participants={c.participants} overlap={c.overlap} /></main>
      <footer className="room-foot">
        <div
          className={`quality quality-${qTone}`}
          title="Realtime audio condition heuristic; not environmental noise classification."
        >
          <span className="muted">Mic &amp; Stream Health</span>
          <strong>
            <span aria-hidden="true">{qIcon} </span>
            {qLabel}
            {qCondition && (
              <span style={{ marginLeft: '6px', fontWeight: 600 }}>
                · {qCondition}
              </span>
            )}
            {qDetail && (
              <span className="muted" style={{ fontWeight: 'normal', fontSize: '0.85em', marginLeft: '6px' }}>
                · {qDetail}
              </span>
            )}
          </strong>
        </div>
        <MicButton status={mic.status} onClick={toggleMic} />
        {c.status === 'disconnected' && <button className="btn btn-sm btn-ghost" onClick={c.reconnect}>Reconnect</button>}
      </footer>
      <div className="toasts" aria-live="polite">{c.notices.map((n) => <div key={n.id} className={`toast toast-${n.tone}`}>{n.text}</div>)}</div>
    </div>
  );
}
