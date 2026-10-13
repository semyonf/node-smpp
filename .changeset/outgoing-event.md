---
'@semyonf/smpp': minor
---

Add an `'outgoing'` event, emitted synchronously from `session.send()` for every pdu handed to the
socket: requests and responses, including the automatic `enquire_link`, `enquire_link_resp` and
`unbind_resp`.

The `'send'` event is emitted from the write callback, and Node does not guarantee that it runs
before the response is read, so the response to a request could be emitted as `'pdu'` before the
request's own `'send'`. `'outgoing'` is emitted once the `sequence_number` is assigned, right after
`socket.write()` was called, so for a request it always comes before the `'pdu'` event of its
response. It is not emitted when `send()` returns `false` or throws.

Also, a pdu that cannot be encoded no longer leaves a pending request behind: `send()` still throws,
but nothing waits for a response that was never asked for.
