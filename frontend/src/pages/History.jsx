import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getAllConversations, downloadTranscript } from '../services/api.js';

export default function History() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getAllConversations()
      .then((data) => {
        if (!active) return;
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[History] Failed to load conversations:', err);
        setError(err.message || 'Failed to load past conversations.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleDownload = async (roomCode, format) => {
    try {
      setDownloading(`${roomCode}-${format}`);
      await downloadTranscript(roomCode, format);
    } catch (err) {
      console.error('[History] Download failed:', err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown date';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return String(isoString);
    }
  };

  const filtered = conversations.filter((c) => {
    if (!c || !c.transcriptCount || c.transcriptCount <= 0) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const codeMatch = (c.roomCode || '').toLowerCase().includes(term);
    const participantMatch = (c.participants || []).some((p) => p.toLowerCase().includes(term));
    return codeMatch || participantMatch;
  });

  return (
    <>
      <Navbar />
      <main className="center">
        <div className="panel" style={{ width: '100%', maxWidth: '820px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
            <div>
              <h1 style={{ margin: 0 }}>Past Conversations</h1>
              <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
                View, search, and export recorded conversations and transcripts.
              </p>
            </div>
            <div className="row">
              <Link to="/create" className="btn btn-sm">Create Room</Link>
              <Link to="/join" className="btn btn-sm btn-ghost">Join Room</Link>
            </div>
          </div>

          <div style={{ margin: '1rem 0' }}>
            <input
              type="search"
              placeholder="Search by room code (e.g. ROUND-2907) or participant name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
              aria-label="Search past conversations"
            />
          </div>

          {loading && <p className="muted">Loading past conversations...</p>}
          {error && <p className="error" role="alert">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <p className="empty" style={{ padding: '2rem 0', textAlign: 'center' }}>
              {search ? 'No conversations match your search.' : 'No past conversations yet.'}
            </p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filtered.map((item, idx) => (
                <div
                  key={item.roomCode}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    padding: '1rem 1.2rem',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    background: '#fff',
                    boxShadow: '0 2px 6px -2px rgba(11, 27, 43, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="muted" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Conversation {idx + 1}
                      </span>
                      <span className="room-code" style={{ fontSize: '1.05rem' }}>{item.roomCode}</span>
                    </div>
                    <time className="muted" style={{ fontSize: '0.85rem' }}>
                      {formatDate(item.latestActivity || item.startTime)}
                    </time>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>
                        <strong>Participants:</strong>{' '}
                        {item.participants && item.participants.length > 0
                          ? item.participants.join(', ')
                          : 'Unknown'}
                      </span>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {item.transcriptCount} {item.transcriptCount === 1 ? 'message' : 'messages'} recorded
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Link to={`/summary?room=${encodeURIComponent(item.roomCode)}`} className="btn btn-sm">
                        View Summary
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(item.roomCode, 'txt')}
                        disabled={downloading === `${item.roomCode}-txt`}
                        className="btn btn-sm btn-ghost"
                        title="Download conversation as TXT"
                      >
                        TXT
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(item.roomCode, 'srt')}
                        disabled={downloading === `${item.roomCode}-srt`}
                        className="btn btn-sm btn-ghost"
                        title="Download conversation as SRT subtitles"
                      >
                        SRT
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border, var(--line))', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <Link to="/" className="btn btn-ghost">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
