// Single switch between MOCK and REAL data. Decided once at startup; never changes mid-session.
const env = import.meta.env;
export const API_URL = (env.VITE_API_URL || '').replace(/\/$/, '');
const wantMock = env.VITE_USE_MOCK !== 'false';
const realReady = !!API_URL;
// Fallback: real mode requested but backend not configured -> mock (with a console warning).
export const MODE = wantMock || !realReady ? 'mock' : 'real';
export const isMock = MODE === 'mock';
// Socket.IO connects to the backend ORIGIN (no path), derived from VITE_API_URL.
export const SOCKET_URL = realReady ? new URL(API_URL).origin : '';
if (!wantMock && !realReady) console.warn('[Roundtable] VITE_USE_MOCK=false but VITE_API_URL is missing. Falling back to MOCK mode.');
