---
'@semyonf/smpp': minor
---

Add a `response_timeout` option to `connect()` and `createServer()`, so that requests whose
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
