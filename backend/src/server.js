/**
 * Server Entry Point
 * Creates HTTP server, attaches Socket.IO, starts listening.
 */

require('dotenv').config();

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
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow binary audio chunks
  maxHttpBufferSize: 1e7, // 10 MB
});

// Attach socket handlers
initializeSocketHandlers(io);

// ── Start ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🟢  Roundtable backend running on http://localhost:${PORT}`);
  console.log(`📡  Socket.IO ready — expecting frontend at ${CLIENT_URL}`);
  console.log(`❤️   Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = { server, io };
