---
'@semyonf/smpp': minor
---

Add `session.localAddress` and `session.localPort`, set together with `remoteAddress`/`remotePort`
(on connect for a client session, on creation for a server session, from the underlying TCP socket
on a TLS session) and, like them, kept after the connection has closed, when the socket itself no
longer knows them.
