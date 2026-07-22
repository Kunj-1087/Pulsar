#!/usr/bin/env node

/**
 * Offline Hub Launcher (HTTPS Mode)
 * 
 * Starts Quark over HTTPS using self-signed certificates.
 * Requires mkcert to be installed and certificates to be pre-generated.
 * 
 * Setup instructions:
 *   1. Install mkcert: https://github.com/FiloSottile/mkcert#installation
 *   2. Run: mkcert -install
 *   3. Generate certs: mkcert -cert-file certs/lan-cert.pem -key-file certs/lan-key.pem localhost 127.0.0.1 192.168.x.x
 *   4. Run: npm run offline:https
 */

const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Configuration
const APP_PORT = 3000;
const SIGNALING_PORT = 8080;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CERT_DIR = path.join(PROJECT_ROOT, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'lan-cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'lan-key.pem');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');
const BUILD_DIR = path.join(PROJECT_ROOT, '.next');

// Read package.json for version
let version = '0.1.0';
try {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  version = pkg.version;
} catch (e) {
  // Use default version
}

/**
 * Check if certificates exist
 */
function checkCertificates() {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    console.error(`\n${'╔════════════════════════════════════════════════════════════╗'}`);
    console.error(`${'║'}  ${'\x1b[31mERROR: TLS Certificates Not Found\x1b[0m'}${'                      ║'}`);
    console.error(`${'╚════════════════════════════════════════════════════════════╝'}\n`);
    console.error('  Missing files:');
    if (!fs.existsSync(CERT_FILE))
      console.error(`    - ${CERT_FILE}`);
    if (!fs.existsSync(KEY_FILE)) console.error(`    - ${KEY_FILE}`);
    console.error('');
    console.error('  To generate certificates:');
    console.error('    1. Install mkcert: https://github.com/FiloSottile/mkcert#installation');
    console.error('    2. Run: mkcert -install');
    console.error('    3. Get your LAN IP (run: npm run offline to see it)');
    console.error('    4. Generate certs:');
    console.error(
      '       mkcert -cert-file certs/lan-cert.pem -key-file certs/lan-key.pem \\\\'
    );
    console.error(`       localhost 127.0.0.1 <your-lan-ip>`);
    console.error('');
    process.exit(1);
  }
}

/**
 * Get all non-internal IPv4 addresses on the machine
 */
function getLANIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [interfaceName, interfaceAddrs] of Object.entries(interfaces)) {
    for (const addr of interfaceAddrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push({
          interface: interfaceName,
          address: addr.address,
          priority: getInterfacePriority(interfaceName),
        });
      }
    }
  }

  addresses.sort((a, b) => b.priority - a.priority);
  return addresses;
}

function getInterfacePriority(name) {
  if (/^wlan|^wlp|^en0|^wifi/i.test(name)) return 3;
  if (/^eth|^enp|^en1/i.test(name)) return 2;
  return 1;
}

function getHostname() {
  return os.hostname();
}

/**
 * Print banner for HTTPS mode
 */
async function printBanner(lanAddresses) {
  const protocol = 'https';
  const primaryAddr = lanAddresses[0] ? lanAddresses[0].address : '127.0.0.1';
  const primaryUrl = `${protocol}://${primaryAddr}:${APP_PORT}`;

  const resetCode = '\x1b[0m';
  const boldCode = '\x1b[1m';
  const greenCode = '\x1b[32m';
  const yellowCode = '\x1b[33m';
  const blueCode = '\x1b[34m';

  console.log('\n');
  console.log(
    `${boldCode}${blueCode}╔════════════════════════════════════════════════════════════╗${resetCode}`
  );
  console.log(
    `${boldCode}${blueCode}║${resetCode}        ${boldCode}QUARK OFFLINE HUB (HTTPS/WSS)${resetCode}${boldCode}${blueCode}              ║${resetCode}`
  );
  console.log(
    `${boldCode}${blueCode}╚════════════════════════════════════════════════════════════╝${resetCode}`
  );
  console.log('');
  console.log(`  Version:     ${version}`);
  console.log(`  Mode:        HTTPS (Secure with self-signed cert)`);
  console.log('');
  console.log(`  ${greenCode}Connection URLs:${resetCode}`);
  console.log(`    Local:     https://localhost:${APP_PORT}`);

  lanAddresses.forEach((addr, idx) => {
    const label = idx === 0 ? 'LAN IP' : 'Alt IP';
    console.log(`    ${label}:      ${protocol}://${addr.address}:${APP_PORT} (${addr.interface})`);
  });

  const hostname = getHostname();
  console.log(`    Hostname:  ${protocol}://${hostname}.local:${APP_PORT}`);

  console.log('');
  console.log(`  ${greenCode}Signaling Server:${resetCode}`);
  console.log(`    Primary:   wss://${primaryAddr}:${SIGNALING_PORT}/signal`);
  console.log('');

  // Certificate info
  console.log(`  ${yellowCode}Certificate Info:${resetCode}`);
  console.log(`    File:      ${CERT_FILE}`);
  console.log('');
  console.log(`  ${yellowCode}iOS / Android Setup:${resetCode}`);
  console.log(
    `    1. Open Settings > General > VPN & Device Management (or Profiles & Device Mgmt)`
  );
  console.log('    2. Install the mkcert root certificate');
  console.log(`    3. Find mkcert CA location: mkcert -CAROOT`);
  console.log('    4. Transfer rootCA.pem to your phone (email, AirDrop, etc.)');
  console.log('    5. On phone: open the file and trust it in Settings');
  console.log('');
  console.log(
    `  ${yellowCode}Scan the QR code below with your phone, or open the URL above:${resetCode}`
  );
  console.log('');

  // Generate and print QR code
  try {
    const qrCode = await QRCode.toString(primaryUrl, {
      type: 'terminal',
      width: 8,
    });
    const lines = qrCode.split('\n');
    lines.forEach((line) => {
      console.log(`    ${line}`);
    });
  } catch (err) {
    console.log(`    ${yellowCode}[QR code generation failed: ${err.message}]${resetCode}`);
  }

  console.log('');
  console.log(`  ${greenCode}Press Ctrl+C to stop the hub.${resetCode}`);
  console.log('');
}

/**
 * Start a child process
 */
function startProcess(name, command, args, env) {
  console.log(`[Launcher] Starting ${name}...`);

  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
  });

  child.on('error', (err) => {
    console.error(`[Launcher] Error starting ${name}:`, err.message);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && !shuttingDown) {
      console.error(
        `[Launcher] ${name} exited unexpectedly with code ${code} or signal ${signal}`
      );
      shutdown();
    }
  });

  return child;
}

let shuttingDown = false;
let processes = [];

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\n[Launcher] Shutting down gracefully...');

  processes.forEach((proc) => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });

  setTimeout(() => {
    processes.forEach((proc) => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
}

async function main() {
  // Check production build exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`[Launcher] ERROR: Production build not found at ${BUILD_DIR}`);
    console.error('[Launcher] Please run: npm run build');
    process.exit(1);
  }

  // Check for certificates
  checkCertificates();

  // Get LAN addresses
  const lanAddresses = getLANIPAddresses();

  if (lanAddresses.length === 0) {
    console.error('[Launcher] ERROR: No LAN network interfaces found');
    process.exit(1);
  }

  // Print banner
  await printBanner(lanAddresses);

  // Prepare environment
  const serverEnv = {
    NEXT_PUBLIC_OFFLINE_MODE: 'true',
    NEXT_PUBLIC_SIGNALING_PORT: SIGNALING_PORT.toString(),
    OFFLINE_MODE: 'true',
    SIGNALING_PORT: SIGNALING_PORT.toString(),
    HTTPS_ENABLED: 'true',
    TLS_CERT_PATH: CERT_FILE,
    TLS_KEY_PATH: KEY_FILE,
    NODE_ENV: 'production',
  };

  // Start signaling server
  const signalingProcess = startProcess(
    'Signaling Server (WSS)',
    'node',
    [path.join(PROJECT_ROOT, 'server.js')],
    serverEnv
  );
  processes.push(signalingProcess);

  // Wait for signaling server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Start custom Next.js HTTPS server
  const nextProcess = startProcess(
    'Next.js Server (HTTPS)',
    'node',
    [path.join(__dirname, 'next-https-server.js')],
    serverEnv
  );
  processes.push(nextProcess);

  // Handle signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Launcher] Fatal error:', err);
  process.exit(1);
});
