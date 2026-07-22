# Quark Scripts

This directory contains helper scripts for deploying and running Quark in various configurations.

## offline-hub.js

Launches Quark in **offline LAN mode** over HTTP.

**Usage:**
```bash
npm run offline       # Production mode (requires npm run build first)
npm run offline:dev   # Development mode (uses next dev)
```

**What it does:**
- Detects your machine's LAN IP address(es)
- Prints a connection banner with URLs
- Generates a scannable QR code for phone access
- Starts both the Next.js server (port 3000) and signaling server (port 8080)
- Manages both processes together with graceful shutdown

**Example output:**
```
╔════════════════════════════════════════════════════════════╗
║                  QUARK OFFLINE HUB                       ║
╚════════════════════════════════════════════════════════════╝

  Version:     0.1.0
  Mode:        HTTP (Local)

  Connection URLs:
    Local:     http://localhost:3000
    LAN IP:    http://192.168.1.100:3000 (wlan0)
    Hostname:  http://quark.local:3000 (if mDNS available)

  Signaling Server:
    Primary:   ws://192.168.1.100:8080/signal

  [QR Code ASCII art here]

  Press Ctrl+C to stop the hub.
```

### When to use HTTP mode
- **Localhost testing**: Single machine development
- **Trusted LANs**: Home WiFi, office WiFi, personal hotspot
- **Chrome-based browsers**: Android Chrome, Chromium on desktop automatically trust private IP addresses
- **Quick setup**: No certificate management needed

### When HTTP is NOT safe
- **iOS Safari**: Requires HTTPS for WebSocket connections
- **Corporate networks**: Strict certificate policies
- **Public WiFi**: Open networks without WPA2/3
- **Sensitive data**: Always prefer HTTPS for security

## offline-hub-https.js

Launches Quark in **offline LAN mode** over HTTPS with self-signed certificates.

**Prerequisites:**
1. Install mkcert: https://github.com/FiloSottile/mkcert#installation
2. Run `mkcert -install` to install the root CA
3. Get your LAN IP (run `npm run offline` first to see it)
4. Generate certificates (replace `192.168.x.x` with your actual LAN IP):
   ```bash
   mkcert -cert-file certs/lan-cert.pem -key-file certs/lan-key.pem \
     localhost 127.0.0.1 192.168.x.x quark.local
   ```

**Usage:**
```bash
npm run offline:https  # Production mode (requires npm run build first)
```

**What it does:**
- Same as offline-hub.js but with HTTPS/WSS
- Reads self-signed certificates from `certs/` directory
- Serves Next.js over HTTPS on port 3000
- Signaling server runs over WSS on port 8080

### Installing certificates on phones

**iOS:**
1. Transfer `rootCA.pem` from `mkcert -CAROOT` to your phone (AirDrop, email, etc.)
2. Open the file on your phone
3. Go to Settings > General > VPN & Device Management (or Profiles & Device Mgmt)
4. Tap the certificate and select "Trust"

**Android:**
1. Transfer `rootCA.pem` to your phone
2. Go to Settings > Security > Install from SD Card (varies by OS version)
3. Select the certificate file
4. Name it and confirm the installation

## next-https-server.js

Custom HTTPS server that runs Next.js in production mode over HTTPS. Automatically called by `offline-hub-https.js`.

Used internally by the HTTPS launcher. Do not call directly.

## Environment Variables

All scripts set these environment variables automatically:

- `NEXT_PUBLIC_OFFLINE_MODE=true`: Disables STUN, TURN, Ably fallback
- `OFFLINE_MODE=true`: Server-side flag for relaxed rate limiting
- `SIGNALING_PORT=8080`: Port the signaling server listens on
- `NEXT_PUBLIC_SIGNALING_PORT=8080`: Port clients use to connect to signaling
- `HTTPS_ENABLED=true`: (https mode only) Enables HTTPS/WSS
- `TLS_CERT_PATH`: (https mode only) Path to certificate file
- `TLS_KEY_PATH`: (https mode only) Path to key file

## Troubleshooting

### "Build not found" error
Solution: Run `npm run build` before `npm run offline`

### Phone cannot reach the laptop URL
- Verify both devices are on the same WiFi network
- Check your router for AP isolation (guest mode) - most phones with hotspots have this disabled by default
- Try a dedicated WiFi network or use a laptop hotspot instead
- If IP-based URL doesn't work, try the hostname (`.local`) on mDNS-aware networks

### HTTPS certificate warning on phone
- **iOS**: Follow the certificate installation steps above
- **Android**: Same as above
- **Chrome warning but "proceed anyway" button shown**: The root CA is not installed. Install it first.

### WSS (secure WebSocket) not working
- Check that your TLS certificate includes the correct IP or hostname
- On iOS, verify the certificate is installed in Settings
- Try accessing `https://` via browser first to verify the cert works

### Different device on the same hotspot can't reach the hub
- iPhone hotspots and many Android hotspots enable "AP isolation" by default
- Use a dedicated WiFi network, home router, or a laptop hotspot instead
- Check your hotspot settings for "Client Isolation", "AP Isolation", or "Guest Mode"

### Multiple network interfaces showing
This is normal! Use the WiFi interface (usually `wlan0` on Linux, `en0`/`en1` on Mac, etc.). Pick the one your other devices are connected to.

---

**Version:** Quark 0.1.0
**Mode:** Offline LAN deployment
**License:** MIT
