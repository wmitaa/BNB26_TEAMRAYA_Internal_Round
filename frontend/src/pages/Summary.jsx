import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getRoomHistory, getExportUrl } from '../services/api.js';
import { formatTime } from '../utils/formatTime.js';

export default function Summary() {
  const [searchParams] = useSearchParams();
  const roomCode = (searchParams.get('room') || '').trim().toUpperCase();

  const [transcripts, setTranscripts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomCode) return;
    let active = true;
    setLoading(true);
    setError('');

    getRoomHistory(roomCode, search)
      .then((data) => {
        if (!active) return;
        setTranscripts(data.transcripts || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[Summary] Error loading history:', err);
        setError(err.message || 'Failed to load conversation history.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [roomCode, search]);

  const displayTime = (ts) => {
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? String(ts) : formatTime(d);
    } catch (_) {
      return String(ts);
    }
  };

  return (
    <>
      <Navbar />
      <main className="center">
        <div className="panel" style={{ width: '100%', maxWidth: '720px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: 0 }}>Conversation History</h1>
              <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
                {roomCode ? `Room: ${roomCode}` : 'No room specified'}
              </p>
            </div>
            {roomCode && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={getExportUrl(roomCode, 'txt')}
                  download={`roundtable-${roomCode}.txt`}
                  className="btn btn-sm btn-ghost"
                >
                  Download TXT
                </a>
                <a
                  href={getExportUrl(roomCode, 'srt')}
                  download={`roundtable-${roomCode}.srt`}
                  className="btn btn-sm btn-ghost"
                >
                  Download SRT
                </a>
              </div>
            )}
          </div>

          {!roomCode ? (
            <p className="muted">No room code specified. Return to home to start or join a conversation.</p>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="search"
                  placeholder="Search conversation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {loading && <p className="muted">Loading transcript history...</p>}
              {error && <p className="error" role="alert">{error}</p>}

              {!loading && !error && transcripts.length === 0 && (
                <p className="empty">
                  {search ? 'No matching conversation messages found.' : 'No transcripts recorded for this room.'}
                </p>
              )}

              {!loading && transcripts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                  {transcripts.map((t, idx) => (
                    <article key={t.transcriptId || idx} className="msg msg-final">
                      <div className="msg-meta">
                        <time>{displayTime(t.timestamp)}</time>
                        <strong style={{ fontSize: '0.85rem' }}>{t.speakerName || 'Speaker'}</strong>
                        <span className="chip chip-final">Final</span>
                        {t.confidence != null && (
                          <span
                            className="conf"
                            title="STT model confidence; not ground-truth transcription accuracy."
                          >
                            STT Confidence: {Math.round(t.confidence > 1 ? t.confidence : t.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.25rem 0 0 0' }}>{t.text}</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <Link to="/" className="btn btn-ghost">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
