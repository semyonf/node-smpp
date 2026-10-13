---
'@semyonf/smpp': patch
---

Fix a session silently going deaf after one of its listeners threw.

An exception thrown by a `'pdu'` or command listener, or by a `responseCallback`, unwound the read
loop with its busy flag still set, after which every further `'readable'` event was ignored and the
session stopped reading the socket for good (until an `enquire_link` timeout, if any). An exception
in a `'debug'`/`'metrics'` listener or `debugListener` during `pdu.command.in` did the same, and was
reported as an `'error'` of the session as if the stream were corrupt. A `'send'` listener that
threw skipped the `sendCallback`.

The busy flag is now reset however the loop ends, and every listener and callback the session calls
while handling a pdu (`'outgoing'`, `'send'`, `'pdu'`, the command events, `'debug'`/`'metrics'`
for `pdu.command.in`/`pdu.command.out`, `responseCallback`, `sendCallback`, `failureCallback`) is
isolated: the exception is emitted as a new `'listener_error'` event with `{ error, event, pdu }`,
and rethrown asynchronously when nothing listens for it, so it still surfaces as an uncaught
exception as before, only without breaking the session.
