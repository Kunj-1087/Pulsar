# Pulsar

> Signal travels. No server needed.

Pulsar is a free, open-source, serverless peer-to-peer (P2P) real-time chat and file-sharing Progressive Web App (PWA) that connects devices directly without central message servers.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkunjnakrani%2Fpulsar&env=ABLY_API_KEY,NEXT_PUBLIC_STUN_SERVER,NEXT_PUBLIC_MAX_FILE_SIZE_MB,NEXT_PUBLIC_CHUNK_SIZE_BYTES,NEXT_PUBLIC_DEV_MODE)

---

## How It Works

Pulsar establishes connection in 3 steps:

```text
1. Handshake Initiation:
   [ Host (Browser A) ]                 [ Guest (Browser B) ]
            |                                     |
            |--- Join channel `pulsar-room-XYZ`-->| (via Ably)
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

- **Direct P2P Channels**: True device-to-device communication using WebRTC DataChannels.
- **Zero Configuration**: No logins, email addresses, phone numbers, or central accounts.
- **Chunked File Transfer**: Share files up to 100MB directly. Backpressure control guarantees steady transfers.
- **Monochromatic Terminal Design**: Vibrant, minimalist design that works beautifully on mobile and desktop.
- **Progressive Web App (PWA)**: Fully installable directly from your web browser with offline app-shell caching.
- **Diagnostic Panel**: Built-in developer telemetry (`Ctrl+Shift+D`) displaying ICE candidate streams, raw SDPs, latency RTTs, and transfer rates.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Signaling**: Ably Realtime (Free Tier)
- **State Management**: Zustand
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **Styles**: Tailwind CSS
- **PWA Service Worker**: `@ducanh2912/next-pwa`
- **Iconography**: Lucide React

---

## Local Development

Follow these steps to run Pulsar locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kunjnakrani/pulsar-chat.git
   cd pulsar-chat
   ```

2. **Add Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your Ably API key to `ABLY_API_KEY`. Get a free key at [Ably.com](https://ably.com) (200 concurrent connections, free forever).

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Launch the Local Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## Self-Hosting Guide

Pulsar can be self-hosted on **Vercel** with one click:

1. Click the **Deploy with Vercel** button above.
2. Sign in to Vercel and create your project.
3. Configure the environment variables:
   - `ABLY_API_KEY`: Your Ably API Key (obtained from your Ably developer dashboard).
   - `NEXT_PUBLIC_STUN_SERVER`: `stun:stun.l.google.com:19302` (Google STUN address, default).
   - `NEXT_PUBLIC_MAX_FILE_SIZE_MB`: `100` (Default file size limit).
   - `NEXT_PUBLIC_CHUNK_SIZE_BYTES`: `16384` (Default 16KB chunk size).
   - `NEXT_PUBLIC_DEV_MODE`: `false` (Set to `true` to show Developer Diagnostics by default).

---

## Architecture

Pulsar utilizes a mesh network topology:
- **Mesh Connection**: If there are three peers (A, B, C), A establishes direct P2P tunnels to B and C, and B connects directly to C.
- **Ephemeral State**: All message lists are stored in the browser's IndexedDB. They are cleared when you navigate away or close the tab, keeping data private.

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
