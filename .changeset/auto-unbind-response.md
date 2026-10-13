---
'@semyonf/smpp': minor
---

Add an `auto_unbind_response` option to `connect()` and `createServer()` (default `false`): the
session answers an incoming `unbind` with an `unbind_resp` of status `ESME_ROK` and then ends the
connection, before emitting the `'pdu'` and `'unbind'` events. Can be changed at runtime through
`session.autoUnbindResponse`. It is off by default because a handler that already answers `unbind`
would otherwise send the response twice.
