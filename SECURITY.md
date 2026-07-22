# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

Report vulnerabilities to [kunjnakrani/quark](https://github.com/kunjnakrani/quark) via GitHub Issues with the `security` label. Do not open public issues for critical vulnerabilities — instead, email the repository owner or open a [private advisory](https://github.com/kunjnakrani/quark/security/advisories).

## Threat Model

### In Scope (Protected)
- Message content: Confidentiality via AES-256-GCM with ephemeral ECDH P-256 keys
- File content: Same encryption as messages (encrypted chunk protocol)
- Message integrity: AES-GCM authentication tags detect tampering
- Forward secrecy: Ephemeral ECDH keys per connection, never persisted
- Signaling server: Relays only SDP/ICE, cannot read DataChannel traffic
- Replay protection: Per-message sequence numbers validated on receipt
- Protocol downgrade: Version field checked on every inbound message
- XSS: CSP headers (`frame-ancestors 'none'`), no `dangerouslySetInnerHTML` with peer content

### Out of Scope (Not Protected)
- Signaling server sees IP addresses and DTLS fingerprints (inherent to WebRTC)
- Room codes transmitted in plaintext to signaling server
- Identity handles are local and self-asserted (no PKI)
- Malicious peer in room can send arbitrary data (endpoint compromise)
- IndexedDB stores decrypted messages locally (intentional for usability)
- Device-level compromise bypasses all application-level protections

## Security Features

### Protocol Versioning
All DataChannel messages carry a `protocolVersion` field. Receiving peers validate this field and log mismatches as potential downgrade attacks. Current version: `1`.

### Per-Message Sequence Numbers
Every outbound message is assigned a monotonically increasing `seq` number. Receiving peers drop messages with `seq <= lastRecvSeq` to prevent replay attacks.

### Content Security Policy (CSP)
- `default-src 'self'`
- `frame-ancestors 'none'` (clickjacking protection)
- `connect-src 'self' ws: wss: https://*.ably.io` (WebSocket + Ably)
- `img-src 'self' blob: data:` (file previews, QR codes)
- `worker-src 'self' blob:` (service worker)
- HSTS enabled in production

### Signaling Server Hardening
- Per-IP rate limiting (connection, join, message)
- Origin header validation
- Connection lifetime limits
- Maximum message size enforcement
- Room join limits (max 6 peers)
- SDP/ICE payload size bounds

### Encryption
- Key exchange: ECDH P-256 (NIST curve)
- Key derivation: HKDF-SHA256 with domain separation
- Message encryption: AES-256-GCM with random 12-byte IV
- Context binding: HKDF info string includes protocol version, sorted peer IDs, room ID, and optional room password hash

### Room Password (Optional)
If set, the room password is hashed (SHA-256) and included in the HKDF info string. Peers without the password derive different encryption keys and cannot decrypt messages.

### Disappearing Messages
Messages can be sent with a `disappearAfterMs` timer. The client deletes expired messages from IndexedDB every 30 seconds. Ephemeral mode skips persistence entirely.

### Panic Wipe
The Security Center provides a one-click "Panic Wipe" that clears all IndexedDB data, localStorage, sessionStorage, and Cache API entries.

## Dependencies

Audit status: Known vulnerabilities exist in Next.js 14.2.35 and transitive dependencies. Upgrade to Next.js 16 requires breaking changes and comprehensive testing. See `npm audit` output for details.

## Security Headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | Restrictive CSP |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | no-referrer |
| Permissions-Policy | Restricted API access |
| Strict-Transport-Security | max-age=31536000 (production) |
