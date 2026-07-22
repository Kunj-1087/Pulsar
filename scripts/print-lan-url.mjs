import os from 'os';

const interfaces = os.networkInterfaces();
const lanIp = Object.values(interfaces)
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

if (lanIp) {
  console.log(`\nLAN signaling URL: ws://${lanIp}:8080`);
  console.log(`Set NEXT_PUBLIC_SIGNALING_WS_URL=ws://${lanIp}:8080 on other devices\n`);
} else {
  console.log('\nCould not detect LAN IP. Check your network connection.\n');
}
