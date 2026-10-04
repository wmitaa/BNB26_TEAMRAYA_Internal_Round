// Single switch between MOCK and REAL data. Decided once at startup; never changes mid-session.
const env = import.meta.env;
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
// If running in browser on Vite dev server (port 5173) or if VITE_API_URL is omitted, use current origin
// so requests go through Vite reverse proxy and avoid cross-origin self-signed certificate mismatches.
export const API_URL = (
  typeof window !== 'undefined' && (window.location.port === '5173' || !env.VITE_API_URL)
    ? window.location.origin
    : (env.VITE_API_URL || browserOrigin)
).replace(/\/$/, '');
const wantMock = env.VITE_USE_MOCK !== 'false';
const realReady = !!API_URL;
// Fallback: real mode requested but backend not configured -> mock (with a console warning).
export const MODE = wantMock || !realReady ? 'mock' : 'real';
export const isMock = MODE === 'mock';
// Socket.IO connects to the backend ORIGIN (no path), derived from API_URL.
export const SOCKET_URL = realReady ? new URL(API_URL, browserOrigin || 'http://localhost:5173').origin : '';
if (!wantMock && !realReady) console.warn('[Roundtable] VITE_USE_MOCK=false but VITE_API_URL is missing. Falling back to MOCK mode.');
