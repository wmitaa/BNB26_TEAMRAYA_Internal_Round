import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import SpeakerBadge from '../components/SpeakerBadge.jsx';
import { demoParticipants, demoTranscript } from '../utils/demoData.js';
// Static marketing preview: intentionally uses demo data and is never connected to a room.
export default function Home() {
  return (
    <>
      <Navbar />
      <main className="hero">
        <div className="hero-copy">
          <h1>Live captions for real conversations.</h1>
          <p>Connect nearby devices and turn group conversations into clear, speaker-attributed live captions. Roundtable combines every device at the table to follow who is speaking, even when voices overlap.</p>
          <div className="row">
            <Link to="/create" className="btn">Create a Room</Link>
            <Link to="/join" className="btn btn-ghost">Join a Room</Link>
            <Link to="/history" className="btn btn-ghost">Past Conversations</Link>
          </div>
        </div>
        <div className="preview" aria-label="Preview of a live conversation">
          <div className="preview-bar">
            <span className="live"><i />LIVE</span>
            <span className="conn conn-connected"><span aria-hidden="true">●</span>Connected</span>
            <span className="muted">3 participants</span>
            <span className="mic-state" aria-label="Microphone on">🎤</span>
          </div>
          {demoTranscript.map((m) => (
            <div key={m.id} className="preview-line">
              <SpeakerBadge participant={demoParticipants.find((p) => p.id === m.speakerId)} />
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
