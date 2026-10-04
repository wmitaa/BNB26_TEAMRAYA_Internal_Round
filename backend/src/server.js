/**
 * Server Entry Point
 * Creates HTTP server, attaches Socket.IO, starts listening.
 */

const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initializeSocketHandlers } = require('./websocket/socketHandler');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── HTTP Server ────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow binary audio chunks
  maxHttpBufferSize: 1e7, // 10 MB
});

// Attach socket handlers
initializeSocketHandlers(io);

// ── Start ──────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🟢  Roundtable backend running on http://0.0.0.0:${PORT}`);
  console.log(`📡  Socket.IO ready — expecting frontend at ${CLIENT_URL}`);
  console.log(`❤️   Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = { server, io };
