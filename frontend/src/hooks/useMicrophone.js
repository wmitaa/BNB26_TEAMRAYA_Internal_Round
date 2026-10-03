import { useState, useEffect, useCallback, useRef } from 'react';
import * as audio from '../services/audio.js';
// status: prompt | ready | on | muted | denied | unavailable
// onChunk (optional) receives { audioData, mimeType, timestamp } while the mic is on and unmuted.
export default function useMicrophone(onChunk) {
  const [permission, setPermission] = useState('prompt');
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const cb = useRef(onChunk); cb.current = onChunk;
  useEffect(() => { audio.queryPermission().then(setPermission); return () => audio.stop(); }, []);
  const allow = useCallback(async () => {
    try { await audio.requestAccess(); setPermission('granted'); } catch (e) { setPermission(e.code); }
  }, []);
  const start = useCallback(async () => {
    try { await audio.start((c) => cb.current?.(c)); setPermission('granted'); setActive(true); setMuted(false); }
    catch (e) { setPermission(e.code || 'unavailable'); setActive(false); }
  }, []);
  const toggle = useCallback(() => {
    if (!active) return start();
    const next = !muted; audio.setMuted(next); setMuted(next);
  }, [active, muted, start]);
  const status = permission === 'denied' ? 'denied' : permission === 'unavailable' ? 'unavailable'
    : active ? (muted ? 'muted' : 'on') : permission === 'granted' ? 'ready' : 'prompt';
  return { status, active, muted, allow, start, toggle };
}
