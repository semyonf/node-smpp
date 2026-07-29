---
'@semyonf/smpp': minor
---

Add `getPeerCertificate([detailed])` to `Session`, exposing the certificate presented by the TLS
peer.

The certificate only lives on the TLS socket, which is private, so monitoring the expiry of a
provider certificate on an outgoing SMPP connection was impossible until the handshake started
failing with `CERT_HAS_EXPIRED`. The new method returns Node's own `PeerCertificate` (or
`DetailedPeerCertificate` when called with `true`), so `valid_to` is readable while the session is
still healthy.

The return value is passed through from Node untouched, because the cases are meaningfully
different: `undefined` means the session is not TLS at all, `{}` means TLS is up but the peer sent
no certificate (a server session without `requestCert`), and `null` means the socket has already
been destroyed. Nothing is cached and no validation is performed — the certificate is read from the
live socket on every call.
