# PULSAR — Product Requirements Document

> **"Signal travels. No server needed."**

---

| Field | Value |
|---|---|
| Document Version | v1.0 |
| Project Name | Pulsar |
| Document Type | Product Requirements Document (PRD) |
| Status | Draft — In Review |
| Author | Kunj Nakrani (CTO / Founder) |
| Created | July 2026 |
| Last Updated | July 2026 |
| Classification | Internal / Open Source |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Target Audience](#4-target-audience)
5. [Core Concepts & Technology](#5-core-concepts--technology)
6. [User Flows](#6-user-flows)
7. [Feature Specifications — V1](#7-feature-specifications--v1)
8. [Feature Specifications — V2 (SaaS)](#8-feature-specifications--v2-saas)
9. [Technical Architecture](#9-technical-architecture)
10. [Tech Stack](#10-tech-stack)
11. [Brand & Design System](#11-brand--design-system)
12. [API & Data Contracts](#12-api--data-contracts)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Developer Mode](#14-developer-mode)
15. [Open Source Strategy](#15-open-source-strategy)
16. [Portfolio & CV Positioning](#16-portfolio--cv-positioning)
17. [Version Roadmap](#17-version-roadmap)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Glossary](#19-glossary)
20. [Appendix](#20-appendix)

---

## 1. Executive Summary

Pulsar is a free, open-source, serverless peer-to-peer (P2P) real-time chat application that enables two or more devices to communicate directly over a local network (LAN) or the internet without requiring a central message server. Powered by WebRTC DataChannels, Pulsar eliminates hosting costs, preserves user privacy, and operates fully offline when devices share the same Wi-Fi network.

The application is a Progressive Web App (PWA) built on Next.js, deployable to Vercel in one click. It is designed as a portfolio-grade open-source project that demonstrates advanced full-stack and P2P networking competence.

A future V2 version will introduce a hosted SaaS tier with payment integration, persistent message history, and enterprise features.

---

## 2. Problem Statement

### 2.1 The Core Problem

Modern chat tools (WhatsApp, Telegram, Slack) require internet connectivity, centralized servers, phone numbers or email accounts, and trust in third-party infrastructure. This creates friction and dependency in scenarios where:

- Two developers on the same network want to share files instantly without cloud upload
- A team operates in a low-connectivity environment (offices with firewalls, remote sites)
- A user values complete data privacy — messages should never leave their device
- A developer wants a self-hostable, auditable communication tool

### 2.2 Existing Solution Gaps

| Tool | Requires Internet | No Login | Self-Hostable | File Sharing | Free Forever |
|---|---|---|---|---|---|
| WhatsApp | Yes | No | No | Yes | No |
| Telegram | Yes | No | Partial | Yes | Partial |
| Slack | Yes | No | No | Yes | No |
| LocalSend | No | Yes | Yes | Yes | Yes |
| **Pulsar (this)** | **No (LAN)** | **Yes** | **Yes** | **Yes** | **Yes** |

Pulsar fills the gap: a browser-based, login-free, offline-capable, self-hostable chat and file sharing tool that works on any device with a browser.

---

## 3. Product Vision & Goals

### 3.1 Vision Statement

> *"A world where two devices can talk to each other without asking permission from a server."*

### 3.2 Product Goals

- Build a WebRTC-first P2P chat tool that works offline on LAN
- Require zero login, zero account, zero phone number
- Enable file sharing (PDF, images, documents) via P2P DataChannels
- Ship as a PWA — installable on mobile and desktop from any browser
- Be 100% free, open source, and self-hostable on Vercel free tier
- Serve as a high-signal portfolio project demonstrating real-world engineering

### 3.3 Success Metrics (V1)

| Metric | Target |
|---|---|
| GitHub Stars (3 months) | 100+ |
| Message latency (LAN) | < 50ms |
| File transfer speed (LAN) | > 5 MB/s |
| PWA install success rate | > 90% |
| Room join time | < 3 seconds |
| Portfolio project engagement | Likes + Comments on portfolio |

---

## 4. Target Audience

### 4.1 Primary Users

- Developers who want a self-hostable internal tool
- Students sharing files on campus Wi-Fi without internet
- Remote teams or field workers on isolated networks
- Privacy-conscious individuals who distrust cloud messaging
- Open source contributors looking for a well-architected WebRTC project

### 4.2 Secondary Users (V2 SaaS)

- Small businesses wanting a private internal chat without Slack costs
- Developers wanting a hosted Pulsar instance without self-hosting

### 4.3 Portfolio Audience

- Recruiters and hiring managers reviewing the portfolio website
- Open source community evaluating the project on GitHub
- Investors or partners assessing technical capability

---

## 5. Core Concepts & Technology

### 5.1 WebRTC — How It Works in Pulsar

WebRTC (Web Real-Time Communication) is a browser API that enables direct peer-to-peer data, audio, and video communication between browsers without a media server. Pulsar uses two WebRTC APIs:

- **RTCPeerConnection** — Establishes the P2P connection between two browsers
- **RTCDataChannel** — Sends arbitrary binary/text data (messages, files) directly between peers

### 5.2 The Signaling Problem

WebRTC peers cannot find each other without an initial handshake. This is called signaling. Pulsar uses a minimal signaling server (Vercel Serverless Function + ephemeral WebSocket relay) to exchange SDP Offers/Answers and ICE Candidates. Once connected, the signaling server plays no further role — all data flows P2P.

### 5.3 ICE, STUN, TURN

| Component | Role | Pulsar Usage |
|---|---|---|
| STUN Server | Discovers public IP of peers | Free Google STUN (stun.l.google.com:19302) |
| TURN Server | Relay if direct connection fails | Not in V1 — added in V2 for cross-network |
| ICE Candidates | Network paths to attempt | Auto-collected by browser |

### 5.4 Offline / LAN Mode

When both devices are on the same Wi-Fi network, WebRTC establishes a direct local connection without traversing the internet. The signaling server is still needed initially but the actual chat data never leaves the local network. This is the core "offline" capability of Pulsar.

### 5.5 PWA (Progressive Web App)

Pulsar is built as a PWA, meaning it can be installed from the browser on both mobile (iOS/Android) and desktop (Windows/Mac/Linux) without going through an app store. It supports offline caching of the app shell via Service Workers, and local message persistence via IndexedDB.

---

## 6. User Flows

### 6.1 Create a Room (Host)

1. User opens Pulsar in browser (or installed PWA)
2. User enters a display name (optional — defaults to "User + random ID")
3. User clicks "Create Room"
4. App generates a unique 6-character Room Code and a shareable URL
5. User shares the code/URL via any channel (AirDrop, message, QR code)
6. App shows "Waiting for peers to join..." status

### 6.2 Join a Room (Guest)

1. User opens Pulsar and enters the Room Code, or opens the shared URL directly
2. Signaling server relays SDP offer/answer between Host and Guest
3. WebRTC P2P connection is established (< 3 seconds on LAN)
4. Chat interface opens. Both users see a "Connected" status indicator

### 6.3 Send a Message

1. User types in the message input field
2. On send (Enter or button), message is serialized to JSON and sent via RTCDataChannel
3. Message appears instantly on both devices with timestamp
4. Message is saved to local IndexedDB for session history

### 6.4 Send a File

1. User clicks the attachment icon and selects a file (PDF, image, etc.)
2. File is chunked into 16KB binary chunks
3. Chunks are sent over RTCDataChannel with metadata (filename, size, type)
4. Receiver reassembles chunks and displays a download prompt or inline preview

### 6.5 Multi-Device Room

1. Host creates room. Multiple guests join using the same code
2. Host establishes separate P2P connections with each guest (mesh topology)
3. Messages broadcast to all peers. Each peer renders all messages in a unified timeline

---

## 7. Feature Specifications — V1

### 7.1 Room System

| Feature | Description | Priority |
|---|---|---|
| Room Creation | Generate unique 6-char alphanumeric room code | P0 |
| Shareable URL | Auto-generate URL with room code as query param (?room=ABC123) | P0 |
| QR Code | Generate QR code for the room URL for mobile scan | P1 |
| Room Expiry | Rooms expire after all peers disconnect (ephemeral) | P0 |
| Display Name | Optional username entry before joining room | P1 |
| Peer Count | Show number of connected peers in UI | P1 |

### 7.2 Messaging

| Feature | Description | Priority |
|---|---|---|
| Text Messages | UTF-8 text messages up to 64KB | P0 |
| Timestamps | Each message shows HH:MM timestamp | P0 |
| Sender Label | Messages labeled with sender display name or "You" | P0 |
| Message Bubbles | WhatsApp-style chat bubbles (sent right, received left) | P0 |
| Enter to Send | Enter key sends; Shift+Enter for newline | P1 |
| Message History | Session messages stored in IndexedDB (cleared on tab close) | P1 |
| Typing Indicator | Show "typing..." when peer is composing | P2 |

### 7.3 File Sharing

| Feature | Description | Priority |
|---|---|---|
| File Picker | Click to select any file from device | P0 |
| Drag & Drop | Drag file into chat window to send | P1 |
| Chunked Transfer | Files split into 16KB chunks for DataChannel reliability | P0 |
| Progress Bar | Show transfer % for large files | P0 |
| File Preview | Inline preview for images; download link for PDFs/other | P1 |
| Max File Size | 100MB per file in V1 | P0 |
| Supported Types | All types accepted (PDF, PNG, JPG, DOCX, ZIP, etc.) | P0 |

### 7.4 Connection & Status

| Feature | Description | Priority |
|---|---|---|
| Connection Status | Visual indicator: Connecting / Connected / Disconnected | P0 |
| Reconnection | Auto-attempt reconnect on peer drop | P1 |
| LAN Detection | Show "LAN mode" badge when peers on same network | P2 |
| Peer List | Show all connected peers with status | P1 |

### 7.5 PWA Features

| Feature | Description | Priority |
|---|---|---|
| Installable | Add to Home Screen on mobile / Install on desktop | P0 |
| App Icon | Custom Pulsar icon for installed PWA | P0 |
| Offline App Shell | Service Worker caches UI shell for offline load | P1 |
| Responsive Design | Full mobile + desktop layout support | P0 |

---

## 8. Feature Specifications — V2 (SaaS)

V2 transforms Pulsar from a pure P2P tool to a hosted SaaS product with optional cloud relay for cross-network reliability and premium features.

### 8.1 V2 Feature Set

| Feature | Description |
|---|---|
| TURN Server | Relay server for cross-network connections (NAT traversal) |
| Persistent History | Messages stored server-side with E2E encryption |
| User Accounts | Optional login via email/magic link |
| Payment Integration | Stripe integration for Pro plan (₹199/month or $2.99/month) |
| Room Passwords | Password-protect rooms |
| File Storage | Cloud file storage for 30-day retention |
| Admin Dashboard | Usage analytics for hosted users |
| Custom Domain | Self-hostable with custom domain support |
| API Access | REST API for developers to integrate Pulsar into apps |

### 8.2 V2 Pricing Model

| Plan | Price | Features |
|---|---|---|
| Free (Open Source) | Free forever | Self-host, P2P only, no persistence |
| Hosted Free | Free | Use Pulsar hosted, 2 peers, LAN only |
| Pro | ₹199/month | 10 peers, TURN relay, file history, persistence |
| Team | ₹999/month | Unlimited peers, admin, API, custom domain |

---

## 9. Technical Architecture

### 9.1 System Overview

Pulsar follows a minimal server architecture. The only server-side component is a lightweight signaling layer. All message data flows P2P via WebRTC.

### 9.2 Component Diagram

```
[Browser A (Host)]          [Browser B (Guest)]
       |                           |
       |---(1) SDP Offer --------> |
       |<-- (2) SDP Answer --------|
       |---(3) ICE Candidates ---> |
       |<-- (3) ICE Candidates ----|
       |                           |
       |====(4) P2P DataChannel====|
       |   (Messages / Files)      |
       |                           |
  [Signaling Server] (Vercel Fn)
  - Handles steps 1-3 only
  - No message data ever passes through
```

### 9.3 Signaling Flow (Detailed)

**Step 1 — Room Creation:** Host calls `/api/signal/create`. Server returns `roomId` and opens a WebSocket slot.

**Step 2 — Guest Joins:** Guest calls `/api/signal/join?room=ABC123`. Server routes guest to host's WebSocket slot.

**Step 3 — SDP Exchange:** Host sends `RTCPeerConnection.createOffer()` result through signaling server to guest. Guest responds with `createAnswer()`.

**Step 4 — ICE Exchange:** Both peers send their ICE candidates through the signaling server until a working path is found.

**Step 5 — P2P Established:** DataChannel opens. Signaling WebSocket is closed. Server is no longer involved.

### 9.4 File Transfer Architecture

Files are transferred entirely via RTCDataChannel using a chunked binary protocol:

- Sender serializes file metadata as JSON: `{ name, size, type, totalChunks }`
- File is read as ArrayBuffer and sliced into 16,384-byte (16KB) chunks
- Each chunk is sent with a sequence number for ordering
- Receiver buffers chunks and reassembles on completion
- Receiver triggers download or inline render based on MIME type

---

## 10. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | SSR + PWA support, Vercel-native |
| Language | TypeScript (strict) | Type safety across P2P protocol |
| Styling | Tailwind CSS | Rapid utility-first styling |
| P2P Layer | WebRTC (native browser API) | No library needed, zero cost |
| Signaling | Vercel Serverless + Ably free tier | Free, serverless, scalable |
| Offline Storage | IndexedDB (via Dexie.js) | Local message persistence |
| PWA | next-pwa | Service worker + manifest generation |
| File Handling | File API + ArrayBuffer | Native browser, no dependencies |
| State Management | Zustand | Lightweight, no boilerplate |
| Icons | Lucide React | Clean, consistent icon set |
| QR Code | qrcode.react | Room URL QR generation |
| Deployment | Vercel (free tier) | One-click deploy, free forever |
| Repository | GitHub (public) | Open source, portfolio visible |

### 10.1 Project Structure

```
pulsar/
├── app/
│   ├── page.tsx                      # Landing / Home
│   ├── room/[id]/page.tsx            # Chat Room
│   └── api/
│       └── signal/                   # Signaling API routes
├── components/
│   ├── ChatWindow.tsx
│   ├── MessageBubble.tsx
│   ├── FileTransfer.tsx
│   ├── PeerStatus.tsx
│   └── RoomCreator.tsx
├── lib/
│   ├── webrtc.ts                     # RTCPeerConnection logic
│   ├── signaling.ts                  # WebSocket signaling client
│   ├── fileTransfer.ts               # Chunked file send/receive
│   └── storage.ts                    # IndexedDB via Dexie
├── store/
│   └── chatStore.ts                  # Zustand state
├── public/
│   ├── manifest.json                 # PWA manifest
│   └── icons/                        # PWA icons
└── styles/
    └── globals.css
```

---

## 11. Brand & Design System

### 11.1 Identity

| Element | Value |
|---|---|
| Name | Pulsar |
| Tagline | "Signal travels. No server needed." |
| Inspiration | Astrophysics — Pulsars emit rhythmic radio signals across space, mirroring P2P messaging |
| Personality | Minimal, precise, developer-first, trustworthy |

### 11.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#191919` | Main background (deep dark) |
| `--text-primary` | `#ced0ce` | Body text, UI labels (muted silver-white) |
| `--text-bright` | `#e6e8e6` | Headings, active elements (bright silver) |
| `--surface` | `#242424` | Cards, panels, elevated surfaces |
| `--border` | `#2e2e2e` | Dividers, input borders |
| `--sent-bubble` | `#2a2a2a` | Sent message bubble background |
| `--received-bubble` | `#1f1f1f` | Received message bubble background |

### 11.3 Typography

| Role | Font | Weight / Size |
|---|---|---|
| Display / Logo | Space Mono or JetBrains Mono | Bold, 36–48px |
| UI Body | Inter or Geist Sans | Regular 400, 14–16px |
| Messages | Inter | Regular 400, 15px |
| Code / Dev Mode | JetBrains Mono | Regular 400, 13px |
| Captions / Meta | Inter | Regular 400, 12px, opacity 60% |

### 11.4 Component Standards

- All inputs: border `#2e2e2e`, background `#1a1a1a`, focus ring `#ced0ce` at 40% opacity
- Buttons: solid background `#ced0ce`, text `#191919`, hover: `#e6e8e6`
- Border radius: `6px` for cards, `12px` for bubbles, `4px` for buttons
- No gradients, no glow, no shadows — flat monochromatic terminal aesthetic
- Icons: Lucide React at `16px` or `20px`, `stroke-width: 1.5`

---

## 12. API & Data Contracts

### 12.1 Signaling API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `POST /api/signal/create` | POST | Create a new room, return roomId |
| `GET /api/signal/join` | WebSocket | Join room WebSocket by roomId |
| `POST /api/signal/relay` | POST | Relay SDP/ICE between peers |

### 12.2 WebRTC Message Protocol

```ts
// Text Message
{ type: "message", id: uuid, text: string, sender: string, ts: number }

// File Metadata
{ type: "file-meta", id: uuid, name: string, size: number, mimeType: string, totalChunks: number }

// File Chunk
{ type: "file-chunk", id: uuid, chunk: ArrayBuffer, index: number }

// File Complete
{ type: "file-complete", id: uuid }

// Typing Indicator
{ type: "typing", sender: string }

// Peer Info
{ type: "peer-info", displayName: string, peerId: string }
```

### 12.3 IndexedDB Schema

| Store | Key | Fields |
|---|---|---|
| `messages` | `id` (uuid) | id, roomId, type, text, sender, ts, fileRef? |
| `files` | `id` (uuid) | id, name, size, mimeType, blob, ts |
| `rooms` | `roomId` | roomId, createdAt, peerCount, displayName |

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Message latency < 50ms on LAN; < 200ms on internet |
| File Transfer | Minimum 5 MB/s on LAN; 1 MB/s on internet (limited by WebRTC) |
| Compatibility | Chrome 90+, Firefox 85+, Safari 15+, Edge 90+ |
| Mobile | iOS Safari 15+, Android Chrome 90+ |
| PWA | Lighthouse PWA score > 90 |
| Accessibility | WCAG 2.1 AA — keyboard nav, ARIA labels, sufficient contrast |
| Security | All P2P data encrypted via DTLS (WebRTC default); no server stores messages |
| Privacy | Zero analytics, zero telemetry in V1 open source build |
| Bundle Size | JS bundle < 150KB gzipped |
| Scalability | Signaling server supports 1000 concurrent rooms on Vercel free tier |

---

## 14. Developer Mode

Pulsar includes a built-in Developer Mode panel accessible via keyboard shortcut `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac).

### 14.1 Developer Panel Features

- **ICE Candidate Log** — live log of all ICE candidates as they are gathered
- **SDP Viewer** — display raw SDP Offer/Answer strings, copyable
- **DataChannel Stats** — bytes sent/received, message count, channel state
- **Connection State Machine** — show ICE connection state transitions in real time
- **Latency Ping** — send a ping/pong message and display RTT in ms
- **Network Type** — display connection type (host, srflx, relay)
- **File Transfer Debug** — chunk count, transfer rate, reassembly status

### 14.2 Environment Config

```env
# .env.local
NEXT_PUBLIC_STUN_SERVER=stun:stun.l.google.com:19302
NEXT_PUBLIC_SIGNALING_URL=/api/signal
NEXT_PUBLIC_MAX_FILE_SIZE_MB=100
NEXT_PUBLIC_CHUNK_SIZE_BYTES=16384
NEXT_PUBLIC_DEV_MODE=false   # Set true to enable dev panel by default
```

---

## 15. Open Source Strategy

### 15.1 GitHub Repository

- Repo name: `pulsar-chat` or `use-pulsar`
- License: MIT (most permissive, maximizes adoption)
- README: Full setup guide, architecture diagram, one-click Vercel deploy button
- `CONTRIBUTING.md`: Clear contribution guidelines for community PRs
- Issues: Pre-label issues as `good first issue` for community onboarding

### 15.2 Self-Host Guide

- One-click "Deploy to Vercel" button in README
- Docker Compose file for self-hosted server (V2)
- Environment variable documentation in `.env.example`

### 15.3 Community

- GitHub Discussions for Q&A
- Changelog maintained in `CHANGELOG.md` using Keep a Changelog format
- Semantic versioning: `v1.0.0` → `v1.x.x` for patches, `v2.0.0` for SaaS tier

---

## 16. Portfolio & CV Positioning

### 16.1 Portfolio Website Integration

- Project card on `kunjnakrani.in` with live demo link, GitHub link
- Like button (persisted via localStorage or simple API) — shows social proof
- Comment section — visitors can leave feedback/appreciation
- Tech stack badges displayed on card
- Live peer count or "X rooms created" counter for social proof

### 16.2 CV Talking Points

- Built a serverless P2P chat app using WebRTC DataChannels — no message server required
- Implemented chunked binary file transfer protocol over WebRTC with progress tracking
- Shipped as a PWA with Service Worker offline caching and IndexedDB persistence
- Designed minimal signaling architecture using Vercel Serverless Functions
- Open sourced under MIT, self-hostable on Vercel free tier

### 16.3 Skills Demonstrated

| Skill Area | What Pulsar Shows |
|---|---|
| Networking | WebRTC, ICE, STUN, SDP, P2P protocols |
| Frontend | Next.js App Router, Tailwind, PWA, Service Workers |
| System Design | Minimal server architecture, signaling pattern, mesh topology |
| Product Thinking | No-login UX, offline-first, self-hostable design decisions |
| Open Source | README, CONTRIBUTING, MIT license, GitHub community setup |
| UI/UX | Responsive design, developer mode, file transfer UI |

---

## 17. Version Roadmap

| Version | Timeline | Key Deliverables |
|---|---|---|
| V0.1 — Proof of Concept | Week 1–2 | WebRTC P2P connection, text messages, room codes |
| V0.2 — File Transfer | Week 3–4 | Chunked file send/receive, progress bar, image preview |
| V0.3 — PWA + Design | Week 5–6 | PWA manifest, Service Worker, Pulsar design system applied |
| V1.0 — Public Launch | Week 7–8 | QR codes, developer mode, README, Vercel deploy, GitHub public |
| V1.1 — Polish | Week 9–10 | Typing indicators, reconnection, peer list, mobile UX fixes |
| V2.0 — SaaS | Month 4–6 | TURN server, auth, persistence, Stripe, admin dashboard |

---

## 18. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WebRTC blocked by firewall | Medium | High | Add TURN relay in V2; document firewall requirements clearly |
| Safari WebRTC limitations | Medium | Medium | Test on iOS Safari early; use polyfills where needed |
| Signaling server cost on Vercel | Low | Low | WebSocket connections are short-lived; free tier sufficient for V1 |
| Large file transfers stalling | Medium | Medium | Implement flow control and backpressure on DataChannel buffering |
| Mesh topology complexity (3+ peers) | Medium | Medium | Cap V1 at 6 peers; use SFU in V2 for larger rooms |
| No persistence = data loss on refresh | High | Low | Clear user expectation in UI; IndexedDB for session storage |

---

## 19. Glossary

| Term | Definition |
|---|---|
| WebRTC | Web Real-Time Communication — browser API for P2P media and data |
| RTCPeerConnection | WebRTC API for establishing a P2P connection between browsers |
| RTCDataChannel | WebRTC API for sending arbitrary data between peers |
| SDP | Session Description Protocol — describes media capabilities for WebRTC negotiation |
| ICE | Interactive Connectivity Establishment — process of finding network paths between peers |
| STUN | Session Traversal Utilities for NAT — server that helps peers discover their public IP |
| TURN | Traversal Using Relays around NAT — relay server used when direct P2P fails |
| Signaling | The process of exchanging SDP and ICE information to initiate a WebRTC connection |
| LAN | Local Area Network — devices connected to the same router without internet |
| PWA | Progressive Web App — web app installable on device like a native app |
| IndexedDB | Browser-native key-value database for offline local storage |
| Mesh Topology | Network where every peer connects directly to every other peer |
| Chunking | Splitting large data into smaller pieces for reliable DataChannel transfer |
| DataChannel | Shorthand for RTCDataChannel |
| P2P | Peer-to-peer — direct device-to-device communication without central server |

---

## 20. Appendix

### 20.1 Key References

- WebRTC W3C Spec: https://www.w3.org/TR/webrtc/
- MDN WebRTC Guide: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- Next.js App Router Docs: https://nextjs.org/docs/app
- next-pwa: https://github.com/shadowwalker/next-pwa
- Dexie.js (IndexedDB): https://dexie.org
- Vercel Deployment: https://vercel.com/docs

### 20.2 Decisions Log

| Decision | Chosen Option | Rejected Option | Reason |
|---|---|---|---|
| Realtime Transport | WebRTC DataChannel | WebSocket via server | Zero server cost, true P2P, offline LAN support |
| Signaling | Vercel Serverless + Ably | Railway persistent server | Railway no longer free; Vercel is free |
| Mobile | PWA | React Native app | No app store needed; works on all devices immediately |
| Styling | Tailwind CSS | CSS Modules | Faster, utility-first, consistent with existing stack |
| State | Zustand | Redux | Lightweight, no boilerplate, sufficient for app scale |
| License | MIT | GPL/Apache | Maximum permissiveness to encourage adoption |
| V1 Topology | Mesh (peer-to-peer) | SFU (media server) | No server cost, simpler, sufficient for small rooms (≤6 peers) |

### 20.3 Out of Scope for V1

- Audio/video calls (WebRTC media streams — V3 consideration)
- End-to-end encrypted persistence (V2 cloud feature)
- User accounts or authentication of any kind
- Push notifications
- Mobile native app (React Native)
- TURN server (V2 only)
- Message reactions or threads

---

*— End of Document —*

---

> **How to use this PRD as context:**
> If you hit token limits in a new chat session, upload this file and say:
> *"This is the full PRD for Pulsar, a WebRTC P2P chat PWA. Use this as complete context and continue building."*
> Any model will have everything needed to pick up exactly where we left off.
