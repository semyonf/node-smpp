---
'@semyonf/smpp': minor
---

Add an `'outgoing'` event, emitted synchronously from `session.send()` for every pdu written to the
socket: requests and responses, including the automatic `enquire_link`, `enquire_link_resp` and
`unbind_resp`.

The `'send'` event is emitted from the write callback, which is asynchronous, so the response to a
request could be received and emitted as `'pdu'` before the request's own `'send'`, for instance
when the response arrived in the same chunk. `'outgoing'` is emitted once the `sequence_number` is
assigned and right before the write, so for a request it always comes before the `'pdu'` event of
its response. It is not emitted when the socket is not writable, where `send()` returns `false`.
