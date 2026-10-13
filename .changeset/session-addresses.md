---
'@semyonf/smpp': minor
---

Add `session.localAddress` and `session.localPort`, set together with `remoteAddress`/`remotePort`
(on connect for a client session, on creation for a server session, always from the socket that
carries the TCP connection) and, like them, kept after the connection has closed, when the socket
itself has forgotten its local address. On a proxy-protocol session `remoteAddress`/`remotePort`
still come from the PROXY header, while the local address is that of the TCP connection from the
proxy. Also fixes the client `'connect'` handler, which fell back to `remoteAddress` instead of the
previous `remotePort` when the socket reported no peer port.
