# @semyonf/smpp

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
