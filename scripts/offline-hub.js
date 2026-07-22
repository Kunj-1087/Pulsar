#!/usr/bin/env node

/**
 * Offline Hub Launcher
 * 
 * Starts the Quark Next.js server and signaling server together for offline LAN mode.
 * Detects the machine's LAN IP, prints connection URLs with QR code, and handles process management.
 * 
 * Usage:
 *   npm run offline       - Start with production build (next start)
 *   npm run offline:dev   - Start with dev server (next dev)
 */

const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Configuration
const APP_PORT = 3000;
const SIGNALING_PORT = 8080;
const IS_DEV = process.argv.includes('--dev');
const IS_HTTPS = process.argv.includes('--https');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, '.next');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

// Read package.json for version
let version = '0.1.0';
try {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  version = pkg.version;
} catch (e) {
  // Use default version
}

/**
 * Get all non-internal IPv4 addresses on the machine
 */
function getLANIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [interfaceName, interfaceAddrs] of Object.entries(interfaces)) {
    for (const addr of interfaceAddrs) {
      // Only interested in IPv4, non-internal
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push({
          interface: interfaceName,
          address: addr.address,
          priority: getInterfacePriority(interfaceName),
        });
      }
    }
  }

  // Sort by priority (WiFi > Ethernet > others)
  addresses.sort((a, b) => b.priority - a.priority);
  return addresses;
}

/**
 * Assign priority to interface names for sorting
 * WiFi interfaces get higher priority
 */
function getInterfacePriority(name) {
  if (/^wlan|^wlp|^en0|^wifi/i.test(name)) return 3; // WiFi-like
  if (/^eth|^enp|^en1/i.test(name)) return 2; // Ethernet-like
  return 1; // Other
}

/**
 * Get the hostname, for use with mDNS (.local)
 */
function getHostname() {
  return os.hostname();
}

/**
 * Print a colorized banner with connection information
 */
async function printBanner(lanAddresses) {
  const protocol = IS_HTTPS ? 'https' : 'http';
  const primaryAddr = lanAddresses[0] ? lanAddresses[0].address : '127.0.0.1';
  const primaryUrl = `${protocol}://${primaryAddr}:${APP_PORT}`;

  const resetCode = '\x1b[0m';
  const boldCode = '\x1b[1m';
  const greenCode = '\x1b[32m';
  const yellowCode = '\x1b[33m';

  console.log('\n');
  console.log(
    `${boldCode}${greenCode}╔════════════════════════════════════════════════════════════╗${resetCode}`
  );
  console.log(
    `${boldCode}${greenCode}║${resetCode}                  ${boldCode}QUARK OFFLINE HUB${resetCode}${boldCode}${greenCode}                       ║${resetCode}`
  );
  console.log(
    `${boldCode}${greenCode}╚════════════════════════════════════════════════════════════╝${resetCode}`
  );
  console.log('');
  console.log(`  Version:     ${version}`);
  console.log(`  Mode:        ${IS_HTTPS ? 'HTTPS (Secure)' : 'HTTP (Local)'}`);
  console.log('');
  console.log(`  ${greenCode}Connection URLs:${resetCode}`);
  console.log(`    Local:     http://localhost:${APP_PORT}`);

  // Print all LAN addresses
  lanAddresses.forEach((addr, idx) => {
    const label = idx === 0 ? 'LAN IP' : 'Alt IP';
    console.log(`    ${label}:      ${protocol}://${addr.address}:${APP_PORT} (${addr.interface})`);
  });

  // Print hostname suggestion
  const hostname = getHostname();
  console.log(`    Hostname:  ${protocol}://${hostname}.local:${APP_PORT} (if mDNS available)`);

  console.log('');
  console.log(`  ${greenCode}Signaling Server:${resetCode}`);
  const signalingProtocol = IS_HTTPS ? 'wss' : 'ws';
  console.log(
    `    Primary:   ${signalingProtocol}://${primaryAddr}:${SIGNALING_PORT}/signal`
  );
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
 * Start a child process and handle errors
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

/**
 * Graceful shutdown handler
 */
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

  // Wait a bit for graceful shutdown, then force kill if needed
  setTimeout(() => {
    processes.forEach((proc) => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
}

/**
 * Main launcher entry point
 */
async function main() {
  // Check if production build exists (for non-dev mode)
  if (!IS_DEV && !fs.existsSync(BUILD_DIR)) {
    console.error(`[Launcher] ERROR: Production build not found at ${BUILD_DIR}`);
    console.error('[Launcher] Please run: npm run build');
    process.exit(1);
  }

  // Get LAN addresses
  const lanAddresses = getLANIPAddresses();

  if (lanAddresses.length === 0) {
    console.error('[Launcher] ERROR: No LAN network interfaces found');
    process.exit(1);
  }

  // Print banner with URLs and QR code
  await printBanner(lanAddresses);

  // Prepare environment for both servers
  const serverEnv = {
    NEXT_PUBLIC_OFFLINE_MODE: 'true',
    NEXT_PUBLIC_SIGNALING_PORT: SIGNALING_PORT.toString(),
    OFFLINE_MODE: 'true',
    SIGNALING_PORT: SIGNALING_PORT.toString(),
    NODE_ENV: IS_DEV ? 'development' : 'production',
  };

  if (IS_HTTPS) {
    serverEnv.HTTPS_ENABLED = 'true';
  }

  // Start signaling server
  const signalingProcess = startProcess(
    'Signaling Server',
    'node',
    [path.join(PROJECT_ROOT, 'server.js')],
    serverEnv
  );
  processes.push(signalingProcess);

  // Give signaling server a moment to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Start Next.js server
  const nextCommand = IS_DEV ? 'next' : 'next';
  const nextArgs = IS_DEV ? ['dev'] : ['start'];
  const nextProcess = startProcess('Next.js Server', nextCommand, nextArgs, serverEnv);
  processes.push(nextProcess);

  // Set up signal handlers for graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run the launcher
main().catch((err) => {
  console.error('[Launcher] Fatal error:', err);
  process.exit(1);
});
