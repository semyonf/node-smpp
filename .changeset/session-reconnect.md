---
'@semyonf/smpp': patch
---

Fix `session.connect()`, which could not reconnect a client session: after reconnecting, the session
sent PDUs but never received one, so every response and incoming request was silently lost.

`connect()` reused the socket of the previous connection, and a closed `net.Socket` that connects
again never emits `'readable'`. Each call now opens a new socket, and also:

- resets everything bound to the previous connection: sequence numbers, a partly received PDU
  (which used to corrupt the first PDU of the new connection), the read counters behind the
  `socket.data.in` debug and metrics events, and the `closed` state, so `close(callback)` after a
  reconnect waits for the new connection to close. Requests still awaiting a response fail with
  `ESESSIONCLOSED` when `response_timeout` is set, and are dropped otherwise, as before;
- re-arms `connectTimeout` for every attempt;
- stops emitting events of the previous connection. Reconnecting from an `'error'` listener used to
  be followed by that connection's `'close'`, which made the session look closed again;
- destroys the previous connection first if it is still open or still being established, instead
  of connecting its socket again, which failed with `EALREADY` while it was still connecting;
- throws a clear error on a server session, instead of Node's `ERR_MISSING_ARGS`, and leaves the
  session untouched when `net.connect()` or `tls.connect()` reject the options.

Listeners, options and the `enquire_link` schedule are kept across the reconnect, and reconnecting
from an `enquire_link_timeout` listener keeps the new connection instead of having
`close_on_enquire_link_timeout` destroy it.
