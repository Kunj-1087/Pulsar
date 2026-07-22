/**
 * Custom HTTPS server for Next.js
 * 
 * Used in offline:https mode to serve Next.js over HTTPS with self-signed certificates.
 * This is the standard pattern for HTTPS production servers with Next.js.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { createServer: createNextServer } = require('next');

const APP_PORT = 3000;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || './certs/lan-cert.pem';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || './certs/lan-key.pem';

async function main() {
  // Load certificate and key
  let certOptions;
  try {
    certOptions = {
      cert: fs.readFileSync(TLS_CERT_PATH, 'utf-8'),
      key: fs.readFileSync(TLS_KEY_PATH, 'utf-8'),
    };
  } catch (err) {
    console.error('[Next.js HTTPS] Failed to read certificate files:', err.message);
    process.exit(1);
  }

  // Create and prepare Next.js app
  const app = createNextServer({
    dev: false,
    dir: path.resolve(process.cwd()),
  });

  const handle = app.getRequestHandler();

  // Create HTTPS server
  const server = https.createServer(certOptions, (req, res) => {
    return handle(req, res);
  });

  // Start listening
  server.listen(APP_PORT, '0.0.0.0', () => {
    console.log(`[Next.js HTTPS] Server running on https://0.0.0.0:${APP_PORT}`);
  });

  // Handle signals gracefully
  process.on('SIGTERM', () => {
    console.log('[Next.js HTTPS] SIGTERM received, shutting down...');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Next.js HTTPS] SIGINT received, shutting down...');
    server.close(() => {
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('[Next.js HTTPS] Fatal error:', err);
  process.exit(1);
});
