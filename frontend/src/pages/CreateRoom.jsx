import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { createRoom, saveSession } from '../services/api.js';
export default function CreateRoom() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name to create a conversation.');
    setBusy(true); setError('');
    try { const r = await createRoom(name); saveSession(r); setRoom(r); }
    catch (err) {
      console.error('[CreateRoom] Error:', err);
      setError(err.message || 'We could not create the room. Check your connection and try again.');
    }
    setBusy(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(room.roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Copy failed. Select the code and copy it manually.'); }
  }
  return (
    <>
      <Navbar />
      <main className="center">
        {!room ? (
          <form className="panel" onSubmit={submit} noValidate>
            <h1>Start a conversation</h1>
            <p className="muted">Create a room, then share the code so nearby devices can join.</p>
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" autoComplete="given-name" aria-invalid={!!error} />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn" disabled={busy}>{busy ? 'Creating...' : 'Create Conversation'}</button>
          </form>
        ) : (
          <div className="panel success" role="status">
            <div className="check" aria-hidden="true">✓</div>
            <h1>Your room is ready</h1>
            <div className="code">{room.roomCode}</div>
            <p className="muted">Share this code with participants.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="row">
              <button className="btn btn-ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy room code'}</button>
              <button className="btn" onClick={() => nav('/room')}>Enter room</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
