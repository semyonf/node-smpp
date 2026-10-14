---
'@semyonf/smpp': minor
---

Fix a session silently going deaf after one of its listeners threw, and add a `'listener_error'`
event.

An exception thrown by a `'pdu'` or command listener, or by a `responseCallback`, unwound the read
loop with its busy flag still set, after which every further `'readable'` event was ignored and the
session stopped reading the socket for good (an `enquire_link_timeout` would destroy it, nothing
resumed it). An exception in a `'debug'`/`'metrics'` listener or `debugListener` did the same, and
during `pdu.command.in` was reported as an `'error'` of the session as if the stream were corrupt. A
throwing `'send'` listener skipped the `sendCallback`, a throwing `failureCallback` during `'close'`
skipped the other pending requests and the `'close'` event itself, and a throwing
`'response_timeout'` listener skipped the request's `failureCallback`.

Every listener and callback the session calls is now isolated: the exception is emitted as a
`'listener_error'` event with `{ error, event, pdu }` (type `ListenerErrorReport`), and rethrown on
the next tick when nothing listens for it, so it still surfaces as an uncaught exception, but no
longer from inside `send()`/`resume()`, and only after the rest of the chunk has been handled. The
`'error'` event without a listener is rethrown the same way instead of throwing synchronously out of
the socket handler, where it left the stream stuck.

A pdu that cannot be parsed (bad length, truncated body) now destroys the connection after the
`'error'` event, as the README always said. Until now the session kept the socket open but never
read it again.
