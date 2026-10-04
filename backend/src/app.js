/**
 * Express Application
 * Handles middleware, routes, and error handling.
 */

const express = require('express');
const cors = require('cors');

const roomRoutes = require('./routes/roomRoutes');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// ── Health check ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Roundtable backend is running', timestamp: Date.now() });
});

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/rooms', roomRoutes);

// ── 404 handler ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
