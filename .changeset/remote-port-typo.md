---
'@semyonf/smpp': patch
---

Fix `session.remotePort` on a client session falling back to `remoteAddress` instead of the previous
`remotePort` when the socket reports none.
