import { useEffect, useRef, useState } from 'react';
import * as socket from '../services/socket.js';
const EVENTS = ['snapshot', 'transcript:new', 'speaker', 'participants', 'overlap', 'audio', 'notice'];
export default function useSocket(session, handlers) {
  const [status, setStatus] = useState('connecting');
  const h = useRef(handlers); h.current = handlers;
  useEffect(() => {
    if (!session) return;
    const offs = EVENTS.map((e) => socket.on(e, (d) => h.current[e]?.(d)));
    offs.push(socket.on('status', (s) => { setStatus(s); h.current.status?.(s); }));
    socket.connect(session);
    return () => { offs.forEach((f) => f()); socket.disconnect(); };
  }, [session]);
  return { status, reconnect: socket.reconnect };
}
