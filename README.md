# Quark

> Peer-to-peer chat. Nothing in between.

Quark is a free, open-source, serverless peer-to-peer (P2P) real-time chat and file-sharing Progressive Web App (PWA) that connects devices directly without central message servers.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkunjnakrani%2Fquark&env=ABLY_API_KEY,NEXT_PUBLIC_STUN_SERVER,NEXT_PUBLIC_MAX_FILE_SIZE_MB,NEXT_PUBLIC_CHUNK_SIZE_BYTES,NEXT_PUBLIC_DEV_MODE)

---

## How It Works

Quark establishes connection in 3 steps:

```text
1. Handshake Initiation:
   [ Host (Browser A) ]                 [ Guest (Browser B) ]
            |                                     |
            |--- Join channel `quark-room-XYZ`-->| (via Ably)
            |<-- Send join announcement ----------| (via Ably)

2. WebRTC Negotiation:
   [ Host (Browser A) ]                 [ Guest (Browser B) ]
            |                                     |
            |--- SDP Offer & ICE candidates ----->| (via Ably)
            |<-- SDP Answer & ICE candidates -----| (via Ably)

3. Direct Connection Established:
   [ Host (Browser A) ] ================= [ Guest (Browser B) ]
                         RTCDataChannel
                   (Direct P2P: Chat & Files)
                   * Signaling server offline *
```

Once step 3 completes, signaling channels are torn down, and communication is 100% direct.

---

## Features

- 🔒 **End-to-End Encrypted**: ECDH P-256 + AES-256-GCM. Messages are encrypted before they leave your device.
- 📡 **Direct P2P Channels**: True device-to-device communication using WebRTC DataChannels.
- 🚫 **Zero Configuration**: No logins, email addresses, phone numbers, or central accounts.
- 📁 **Chunked File Transfer**: Share files up to 100MB directly. Backpressure control guarantees steady transfers.
- 🎨 **Monochromatic Terminal Design**: Vibrant, minimalist design that works beautifully on mobile and desktop.
- 📱 **Progressive Web App (PWA)**: Fully installable directly from your web browser with offline app-shell caching.
- 🛠️ **Diagnostic Panel**: Built-in developer telemetry (`Ctrl+Shift+D`) displaying ICE candidate streams, raw SDPs, latency RTTs, and transfer rates.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (Strict Mode) |
| Signaling | WebSocket server + Ably Realtime (Free Tier) |
| State Management | Zustand |
| Local Storage | Dexie.js (IndexedDB wrapper) |
| Styles | Tailwind CSS |
| PWA Service Worker | `@ducanh2912/next-pwa` |
| Iconography | Lucide React |

---

## Running Quark on a Local Network (No Internet Required)

Quark works entirely on your local WiFi. No internet needed.

### Setup (takes 30 seconds)

**One person on the team does this on their laptop:**

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/kunjnakrani/quark.git
   cd quark
   npm install
   ```

2. Start the signaling server:
   ```bash
   npm run signal
   ```

3. In a second terminal, start the app:
   ```bash
   npm run dev
   ```

4. Look at the terminal output. You will see:
   ```
   Network:   http://192.168.1.5:3000   ← share this
   ```

5. Share that Network URL with everyone in the room.
   They open it in their browser. That's it.

### Requirements
- Everyone must be connected to the **same WiFi network**
- The person who ran the setup must keep their laptop open and terminal running
- No internet connection needed once everyone has joined

### How it works
When you create a room, Quark generates a link that contains your machine's local network address. When others open that link, they load the app directly from your machine and connect peer-to-peer. After the initial connection, all messages and files go directly between devices — your laptop is only needed for new people to join.

---

## Offline LAN Mode

Quark can run entirely without internet connectivity on a local network (LAN, WiFi hotspot, or ad-hoc network).

### Quick Start (HTTP)

```bash
npm install
npm run build
npm run offline
```

The launcher will:
- Auto-detect your machine's LAN IP
- Print a QR code to scan from your phone
- Start both the Next.js server and signaling server

Open the printed URL on your phone (same WiFi) and start chatting instantly. No cloud, no accounts, no internet.

### Why Offline LAN Mode?

**Real-world use cases:**
- **Home networks**: Chat with family on a room LAN without ISP involvement
- **Phone hotspots**: Tether a laptop to your phone's hotspot for isolated group chat
- **Laptop hotspots**: Create a personal hotspot for peers to join
- **Offices**: Self-hosted communication on corporate networks
- **Disaster response**: Operate communication infrastructure when internet is down
- **Events**: Temporary communication network without external dependencies
- **Air-gapped networks**: Military, research, or high-security environments
- **Ships & remote sites**: Zero-downtime operation without satellite/terrestrial links

### HTTP vs. HTTPS

| Mode | Command | When | Browser Support |
|------|---------|------|---|
| **HTTP** | `npm run offline` | Localhost, trusted LAN, Android | Chrome, Firefox, Safari (Android only) |
| **HTTPS** | `npm run offline:https` | iOS, corporate networks, hostname | All browsers (requires mkcert setup) |

### HTTPS Setup (Optional)

1. **Install mkcert**: [https://github.com/FiloSottile/mkcert](https://github.com/FiloSottile/mkcert)
   ```bash
   # macOS
   brew install mkcert
   # Ubuntu/Debian
   sudo apt install mkcert
   # Windows (Chocolatey)
   choco install mkcert
   ```

2. **Install root CA**: `mkcert -install`

3. **Generate certificates**:
   ```bash
   mkdir -p certs
   mkcert -cert-file certs/lan-cert.pem -key-file certs/lan-key.pem \
     localhost 127.0.0.1 192.168.1.100 quark.local
   ```

4. **Start HTTPS hub**: `npm run offline:https`

---

## Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kunjnakrani/quark.git
   cd quark
   ```

2. **Add Environment Variables**:
   ```bash
   cp .env.example .env.local
   ```
   Add your Ably API key to `ABLY_API_KEY`. Get a free key at [Ably.com](https://ably.com).

3. **Install Dependencies**: `npm install`

4. **Launch the Dev Server**: `npm run dev`

5. Open `http://localhost:3000` in your web browser.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Quark Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser A                    Browser B                     │
│  ┌──────────┐                ┌──────────┐                   │
│  │ Quark    │ ◄── E2EE ──► │ Quark    │                   │
│  │ WebRTC   │   DataChannel  │ WebRTC   │                   │
│  │ + Crypto │               │ + Crypto │                   │
│  └──────────┘               └──────────┘                   │
│       │                          │                          │
│       └──────────┬───────────────┘                          │
│                  │                                          │
│          ┌───────┴────────┐                                 │
│          │  Signaling     │                                 │
│          │  Server (WS)   │                                 │
│          │  [ephemeral]   │                                 │
│          └────────────────┘                                 │
│                                                             │
│  Features:                                                  │
│  • ECDH P-256 + AES-256-GCM encryption                     │
│  • Full mesh topology (up to 6 peers)                       │
│  • IndexedDB message persistence                            │
│  • Chunked binary file transfer                             │
│  • PWA with offline support                                 │
└─────────────────────────────────────────────────────────────┘
```

Quark utilizes a mesh network topology:
- **Mesh Connection**: If there are three peers (A, B, C), A establishes direct P2P tunnels to B and C, and B connects directly to C.
- **Ephemeral State**: All message lists are stored in the browser's IndexedDB. They are cleared when you navigate away or close the tab, keeping data private.

---

## Security

- **End-to-End Encryption**: All messages and files are encrypted with ECDH key agreement + AES-256-GCM.
- **No Server Storage**: The signaling server never sees message content. It only relays SDP/ICE during connection setup.
- **Forward Secrecy**: Ephemeral keys are generated per connection and never persisted.
- **Room Code Entropy**: 8-character alphanumeric codes with 32+ bits of entropy.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork this repository.
2. Create a branch: `git checkout -b feature/your-awesome-feature`.
3. Commit your changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-awesome-feature`.
5. Create a new Pull Request.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
