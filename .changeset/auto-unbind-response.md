---
'@semyonf/smpp': minor
---

Add an `auto_unbind_response` option to `connect()` and `createServer()` (default `false`): the
session answers an incoming `unbind` with an `unbind_resp` of status `ESME_ROK`, stops its
`enquire_link` schedule and closes the connection (destroying the socket once the `unbind_resp` has
been flushed, so `'close'` follows even if the peer never closes its side), before emitting the
`'pdu'` and `'unbind'` events. Can be changed at runtime through `session.autoUnbindResponse`. It is
off by default so that handlers which already answer `unbind` keep working as they are.
