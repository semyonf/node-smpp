# @semyonf/smpp

## 1.7.0

### Minor Changes

- 180e698: Add `enquire_link` handling to `Session`: answering incoming `enquire_link`, and dropping the link
  when an outgoing one is not answered.

  Until now an incoming `enquire_link` was only emitted as an event, and `auto_enquire_link_period`
  sent `enquire_link` without ever checking the `enquire_link_resp`, so a dead link stayed "open"
  until TCP noticed, which can take many minutes. New options, accepted by both `smpp.connect()` and
  `smpp.createServer()`:

  - `auto_enquire_link_response` (default `false`) answers every incoming `enquire_link`.
  - `enquire_link_timeout` makes every `enquire_link` sent by `auto_enquire_link_period` wait that
    many milliseconds for its response. If none arrives, an `enquire_link_timeout` event is emitted
    with the unanswered `enquire_link`, and the session is destroyed unless
    `close_on_enquire_link_timeout` is `false`.
  - `auto_enquire_link_period` now also works on server sessions, and stops when `session.close()` or
    `session.destroy()` is called instead of firing at a socket that can no longer be written to.
    After `close()` the response to an `enquire_link` still in flight is still awaited, so if the
    peer stopped answering and never closes its side, the timeout destroys the session instead of
    leaving it half-open.

  These `enquire_link` are not subject to `response_timeout`, which is for the requests you send
  yourself, and never show up in `'response_timeout'` or `'response_aborted'` events.

  All of them default to the previous behaviour. At runtime they are controlled with
  `session.startEnquireLink(period, [timeout])`, `session.stopEnquireLink()` and the
  `session.autoEnquireLinkResponse` property.

- ae37b4a: Add a `response_timeout` option to `connect()` and `createServer()`, so that requests whose
  response never arrives stop waiting forever.

  A request sent with a `responseCallback` used to stay pending until its response arrived, which on
  a dead or misbehaving connection is never: its callback was never called, a promise wrapped around
  it never settled, and it was never cleaned up. With `response_timeout` (milliseconds) set, such a
  request now fails through its `failureCallback` with an error whose `code` is `'ERESPONSETIMEOUT'`,
  and a `'response_timeout'` event is emitted with the request pdu, so the timeout is observable even
  without a `failureCallback`. If the session closes first, the requests still waiting fail right
  away, with the code `'ESESSIONCLOSED'` (and the socket error, if any, as `err.cause`), along with a
  `'response_aborted'` event. Each request is reported exactly once, and a response that arrives after
  its request timed out is still emitted as a `'pdu'` event without calling any callback.

  The failure callback receives the actual request pdu with its `command_status` left untouched.
  Unlike a failed socket write, which still sets `ESME_RSUBMITFAIL` as before, a missing response does
  not mean that the request was not processed: the peer may have accepted the message and only the
  response was lost, so resending it may deliver it twice. `err.code` tells the cases apart.

  The option is disabled by default, and nothing changes for sessions that do not set it: pending
  requests are not timed out, and failure callbacks are still only called for requests that could not
  be written, as documented so far. Values other than a number between 0 and 2147483647 throw a
  `RangeError`.

### Patch Changes

- 180e698: Fix `session.connect()`, which could not reconnect a client session: after reconnecting, the session
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

## 1.6.0

### Minor Changes

- 6cfff43: Add `getPeerCertificate([detailed])` to `Session`, exposing the certificate presented by the TLS
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

## 1.5.0

### Minor Changes

- 57643ef: Expose `tls` as a public `readonly boolean` property on `Session`.

  Whether a session runs over TLS was previously only reachable through the private `options` bag or
  through untyped escape hatches (`session.server`, `rootSocket()`), neither of which works for a
  client-mode session. The value already existed at runtime on every construction path — server
  sessions from `createServer()`, client sessions from `connect()` (including `ssmpp://` URLs and the
  explicit `tls` option), and a directly instantiated `new Session()` — and is now surfaced as a typed
  property.

  The field is always a boolean: `new Session({ host, port })` without a `tls` option yields `false`,
  not `undefined`.

## 1.4.0 and earlier

Released before this project adopted [changesets](https://github.com/changesets/changesets). See the
[releases](https://github.com/semyonf/node-smpp/releases) and the git history for those versions.
