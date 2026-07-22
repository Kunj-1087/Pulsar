const os = require('os');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = getLanIp();
const port = process.env.SIGNALING_PORT || 8080;
const wsUrl = `ws://${lanIp}:${port}`;

console.log('\n======================================================');
console.log(' 🌐 QUARK LAN SIGNALING CONFIGURATION');
console.log('======================================================');
console.log(` Host LAN IP:               ${lanIp}`);
console.log(` Signaling Server Port:    ${port}`);
console.log(` WebSocket URL:            ${wsUrl}`);
console.log('------------------------------------------------------');
console.log(' For LAN-only offline peer connections from other devices,');
console.log(' set this in your environment or .env file:');
console.log(` NEXT_PUBLIC_SIGNALING_WS_URL=${wsUrl}`);
console.log('======================================================\n');
