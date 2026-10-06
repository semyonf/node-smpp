---
'@semyonf/smpp': minor
---

Add `enquire_link` handling to `Session`: answering incoming `enquire_link`, and dropping the link
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
  After `close()` the responses to the `enquire_link` already sent are still awaited, so a peer that
  stopped answering and never closes its side is dropped by the timeout instead of hanging
  half-open.

All of them default to the previous behaviour. At runtime they are controlled with
`session.startEnquireLink(period, [timeout])`, `session.stopEnquireLink()` and the
`session.autoEnquireLinkResponse` property.
