import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import useMicrophone from '../hooks/useMicrophone.js';
import { joinRoom, saveSession, isValidCode } from '../services/api.js';
const MIC = {
  prompt: ['Permission required', ''], ready: ['Ready', 'ok'], on: ['Ready', 'ok'], muted: ['Ready', 'ok'],
  denied: ['Blocked — allow microphone access in your browser settings', 'bad'], unavailable: ['No microphone found', 'bad'],
};
export default function JoinRoom() {
  const nav = useNavigate();
  const mic = useMicrophone();
  const [f, setF] = useState({ name: '', code: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Enter your name.';
    if (!f.code.trim()) er.code = 'Enter the room code.';
    else if (!isValidCode(f.code)) er.code = 'Invalid room code. Codes look like ROUND-4821.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { const r = await joinRoom(f.code, f.name); saveSession(r); nav('/room'); }
    catch (err) { setErrors({ form: err.message || 'We could not join this room. Try again.' }); setBusy(false); }
  }
  const [micLabel, micTone] = MIC[mic.status];
  return (
    <>
      <Navbar />
      <main className="center">
        <form className="panel" onSubmit={submit} noValidate>
          <h1>Join a conversation</h1>
          <label htmlFor="name">Your name</label>
          <input id="name" value={f.name} onChange={set('name')} placeholder="Enter your name" aria-invalid={!!errors.name} />
          {errors.name && <p className="error" role="alert">{errors.name}</p>}
          <label htmlFor="code">Room code</label>
          <input id="code" value={f.code} onChange={set('code')} placeholder="ROUND-4821" autoCapitalize="characters" aria-invalid={!!errors.code} />
          {errors.code && <p className="error" role="alert">{errors.code}</p>}
          <div className="mic-check">
            <div><span className="muted">Microphone</span><strong className={micTone}>{micLabel}</strong></div>
            {(mic.status === 'prompt') && <button type="button" className="btn btn-sm btn-ghost" onClick={mic.allow}>Allow</button>}
          </div>
          {errors.form && <p className="error" role="alert">{errors.form}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Joining...' : 'Join Conversation'}</button>
        </form>
      </main>
    </>
  );
}
