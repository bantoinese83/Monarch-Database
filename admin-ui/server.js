#!/usr/bin/env node

/**
 * Monarch Admin UI Server
 *
 * Simple Express server to serve the Admin UI and proxy requests to Monarch Database.
 * In production, you should serve the static files directly and proxy API calls.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3001;
const MONARCH_API_URL = process.env.MONARCH_API_URL || 'http://localhost:3000';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Proxy API requests to Monarch Database
app.use('/api', createProxyMiddleware({
  target: MONARCH_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api' // Keep /api prefix
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({
      error: 'Failed to connect to Monarch Database',
      details: err.message
    });
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'monarch-admin-ui',
    monarchApi: MONARCH_API_URL
  });
});

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Monarch Admin UI running at http://localhost:${PORT}`);
  console.log(`📊 Proxying API requests to: ${MONARCH_API_URL}`);
  console.log(`💡 Make sure Monarch Database is running at ${MONARCH_API_URL}`);
  console.log(`\n📖 Admin UI Features:`);
  console.log(`   • Dashboard with real-time metrics`);
  console.log(`   • Collection browser and query interface`);
  console.log(`   • Schema explorer`);
  console.log(`   • Performance monitoring`);
  console.log(`   • Migration tools`);
  console.log(`\n🔧 Useful commands:`);
  console.log(`   • npm run migrate:redis -- --dry-run`);
  console.log(`   • npm run migrate:mongodb -- --dry-run`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Monarch Admin UI...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Monarch Admin UI...');
  process.exit(0);
});
