---
'@semyonf/smpp': minor
---

Expose `tls` as a public `readonly boolean` property on `Session`.

Whether a session runs over TLS was previously only reachable through the private `options` bag or
through untyped escape hatches (`session.server`, `rootSocket()`), neither of which works for a
client-mode session. The value already existed at runtime on every construction path — server
sessions from `createServer()`, client sessions from `connect()` (including `ssmpp://` URLs and the
explicit `tls` option), and a directly instantiated `new Session()` — and is now surfaced as a typed
property.

The field is always a boolean: `new Session({ host, port })` without a `tls` option yields `false`,
not `undefined`.
