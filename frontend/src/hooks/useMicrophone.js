import { useState, useEffect, useCallback, useRef } from 'react';
import * as audio from '../services/audio.js';
import { stopAudio } from '../services/socket.js';

// status: prompt | ready | on | muted | denied | unavailable
// onChunk (optional) receives { audioData, mimeType, timestamp } while the mic is capturing.
export default function useMicrophone(onChunk) {
  const [permission, setPermission] = useState('prompt');
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [health, setHealth] = useState(null);
  const cb = useRef(onChunk); cb.current = onChunk;

  useEffect(() => {
    audio.queryPermission().then(setPermission);
    return () => {
      audio.stop();
      try { stopAudio(); } catch (_) {}
    };
  }, []);

  const allow = useCallback(async () => {
    try {
      await audio.requestAccess();
      setPermission('granted');
    } catch (e) {
      setPermission(e.code);
    }
  }, []);

  const start = useCallback(async () => {
    try {
      await audio.start(
        (c) => cb.current?.(c),
        (h) => setHealth(h)
      );
      setPermission('granted');
      setActive(true);
      setMuted(false);
    } catch (e) {
      setPermission(e.code || 'unavailable');
      setActive(false);
      setHealth(null);
    }
  }, []);

  const stop = useCallback(() => {
    audio.stop();
    try { stopAudio(); } catch (_) {}
    setActive(false);
    setMuted(false);
    setHealth(null);
  }, []);

  const toggle = useCallback(() => {
    if (!active) return start();
    return stop();
  }, [active, start, stop]);

  const status = permission === 'denied' ? 'denied' : permission === 'unavailable' ? 'unavailable'
    : active ? (muted ? 'muted' : 'on') : permission === 'granted' ? 'ready' : 'prompt';

  return { status, active, muted, allow, start, stop, toggle, health };
}
