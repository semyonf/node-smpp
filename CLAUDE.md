# node-smpp - SMPP Protocol Implementation for Node.js

## Overview

**node-smpp** is a complete TypeScript/Node.js implementation of the SMPP (Short Message Peer-to-Peer) protocol v5.0 with backward compatibility for v3.4. SMPP is a telecommunications protocol used by the mobile industry for exchanging SMS messages between Short Message Service Centers (SMSCs) and External Short Messaging Entities (ESMEs).

**Package**: `@semyonf/smpp` (v1.1.0)
**License**: MIT
**Node.js Version**: >=22
**Repository**: https://github.com/semyonf/node-smpp

---

## Project Structure

```
node-smpp/
├── lib/                      # TypeScript source files
│   ├── index.ts             # Main entry point (re-exports from smpp.ts)
│   ├── smpp.ts              # Core Session and Server implementations
│   ├── pdu.ts               # PDU (Protocol Data Unit) encoding/decoding
│   ├── commands.ts          # SMPP command definitions (27 commands)
│   ├── defs.ts              # Type system, encodings, filters, GSM charset
│   ├── tlvs.ts              # TLV (Tag-Length-Value) parameter definitions
│   ├── consts.ts            # Protocol constants and enums
│   └── errors.ts            # SMPP error/status codes (68 codes)
├── test/                     # Mocha test suite (JavaScript)
│   ├── smpp.js              # Server/client integration tests
│   ├── pdu.js               # PDU parsing/serialization tests
│   ├── encodings.js         # Character encoding tests
│   ├── filters.js           # Message filter tests
│   ├── types.js             # Binary type serialization tests
│   ├── proxy_protocol.js    # Proxy Protocol v1 tests
│   └── fixtures/            # TLS certificates for testing
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Architecture

### Data Flow

```
Application Code
       ↓
   Session/Server (smpp.ts)
       ↓
   PDU Class (pdu.ts)
       ↓
Commands + Types + Filters (commands.ts, defs.ts)
       ↓
Binary Protocol Data over TCP/TLS
```

### Key Components

1. **Session** (`lib/smpp.ts:126-449`): Manages individual SMPP connections. EventEmitter-based with dynamic methods for all SMPP commands.

2. **Server** (`lib/smpp.ts:496-634`): Creates SMPP servers (TCP or TLS). Accepts connections and emits `session` events.

3. **PDU** (`lib/pdu.ts`): Protocol Data Unit - encodes/decodes binary SMPP messages. Handles command headers, parameters, and TLV fields.

4. **Type System** (`lib/defs.ts:4-242`): Binary serialization for int8, int16, int32, cstring, buffer, and complex array types.

5. **Encodings** (`lib/defs.ts:388-433`): ASCII (GSM 03.38), LATIN1, UCS2 with automatic detection.

6. **Filters** (`lib/defs.ts:456-738`): Transform message content, time formats, and structured TLV values during encode/decode.

---

## Core API

### Connecting to an SMPP Server (Client Mode)

```javascript
const smpp = require('@semyonf/smpp');

// URL-based connection
const session = smpp.connect('smpp://example.com:2775');

// Secure connection (TLS)
const secureSession = smpp.connect('ssmpp://example.com:3550');

// Options-based connection
const session = smpp.connect({
  url: 'smpp://example.com:2775',
  auto_enquire_link_period: 10000,  // Keep-alive every 10 seconds
  connectTimeout: 30000,             // Connection timeout (default)
  debug: true                        // Enable debug logging
});
```

### Creating an SMPP Server

```javascript
const smpp = require('@semyonf/smpp');

const server = smpp.createServer({
  debug: true
}, function(session) {
  // Handle new client session
  session.on('error', function(err) {
    console.error('Session error:', err);
  });

  session.on('bind_transceiver', function(pdu) {
    // Authenticate and respond
    session.send(pdu.response());
  });
});

server.listen(2775);
```

### TLS Server

```javascript
const fs = require('fs');
const smpp = require('@semyonf/smpp');

const server = smpp.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  debug: true
}, sessionHandler);

server.listen(3550);
```

---

## Session API

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `remoteAddress` | `string \| null` | Remote IP address |
| `remotePort` | `number \| null` | Remote port |
| `proxyProtocolProxy` | `object \| false` | Proxy protocol info (if enabled) |
| `server` | `Server` | Reference to server (server mode only) |

### Methods

```javascript
// Send a PDU with callbacks
session.send(pdu, responseCallback, sendCallback, failureCallback);

// Flow control
session.pause();   // Pause incoming PDU processing
session.resume();  // Resume processing

// Connection management
session.connect();              // Reconnect closed session
session.close(callback);        // Graceful close
session.destroy(callback);      // Force close
```

### Dynamic Command Methods

All SMPP commands are available as session methods:

```javascript
// Bind as transceiver
session.bind_transceiver({
  system_id: 'USERNAME',
  password: 'PASSWORD'
}, function(pdu) {
  if (pdu.command_status === 0) {
    console.log('Bound successfully');
  }
});

// Send SMS
session.submit_sm({
  source_addr: 'SENDER',
  destination_addr: '+1234567890',
  short_message: 'Hello World!'
}, function(pdu) {
  console.log('Message ID:', pdu.message_id);
});

// Keep-alive
session.enquire_link(function(pdu) {
  console.log('Server is alive');
});

// Unbind
session.unbind();
```

### Events

| Event | Arguments | Description |
|-------|-----------|-------------|
| `connect` | - | TCP connection established (client mode) |
| `secureConnect` | - | TLS handshake complete |
| `close` | - | Connection closed |
| `error` | `(error)` | Error occurred (must be handled!) |
| `pdu` | `(pdu)` | Any PDU received |
| `[command_name]` | `(pdu)` | Specific command (e.g., `submit_sm`, `deliver_sm`) |
| `send` | `(pdu)` | PDU sent successfully |
| `debug` | `(type, msg, payload)` | Debug information |
| `metrics` | `(event, value, payload, context)` | Performance metrics |

---

## PDU (Protocol Data Unit)

### Creating PDUs

```javascript
const smpp = require('@semyonf/smpp');

// Create from command name and options
const pdu = new smpp.PDU('submit_sm', {
  source_addr: 'SENDER',
  destination_addr: '+1234567890',
  short_message: 'Hello!'
});

// Create from binary buffer
const pdu = new smpp.PDU(buffer);
```

### PDU Properties

| Property | Type | Description |
|----------|------|-------------|
| `command` | `string` | Command name (e.g., 'submit_sm') |
| `command_length` | `number` | Total PDU length in bytes |
| `command_id` | `number` | Numeric command ID |
| `command_status` | `number` | Status code (0 = success) |
| `sequence_number` | `number` | Message sequence number |
| `[param]` | `any` | Command-specific parameters |

### PDU Methods

```javascript
pdu.isResponse();              // Check if response PDU
pdu.response({ message_id: '123' }); // Create response PDU
pdu.toBuffer();                // Serialize to Buffer

// Static methods
PDU.fromBuffer(buffer);        // Create PDU from Buffer
PDU.fromStream(stream, length); // Create PDU from stream
PDU.commandLength(stream);     // Read command length from stream
PDU.maxLength;                 // Max PDU size (16384 bytes)
```

---

## SMPP Commands

### Session Management

| Command | Description |
|---------|-------------|
| `bind_receiver` | Bind as receive-only |
| `bind_transmitter` | Bind as send-only |
| `bind_transceiver` | Bind as send/receive |
| `unbind` | Disconnect gracefully |
| `enquire_link` | Keep-alive/heartbeat |
| `generic_nack` | Negative acknowledgement |

### Messaging

| Command | Description |
|---------|-------------|
| `submit_sm` | Send SMS |
| `submit_multi` | Send to multiple recipients |
| `deliver_sm` | Receive SMS (server → client) |
| `data_sm` | Data message |
| `query_sm` | Query message status |
| `cancel_sm` | Cancel pending message |
| `replace_sm` | Replace pending message |

### Broadcast (v5.0)

| Command | Description |
|---------|-------------|
| `broadcast_sm` | Send broadcast message |
| `query_broadcast_sm` | Query broadcast status |
| `cancel_broadcast_sm` | Cancel broadcast |

### Other

| Command | Description |
|---------|-------------|
| `alert_notification` | Alert notification |
| `outbind` | Initiate outbound bind |

---

## Message Encoding

### Automatic Encoding

The library automatically detects and encodes messages:

```javascript
// ASCII (GSM 03.38) - default for standard characters
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: 'Hello World!'
  // data_coding automatically set to 0x01
});

// UCS2 - for Unicode characters
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: 'مرحبا'  // Arabic
  // data_coding automatically set to 0x08
});
```

### Encoding Detection Order

1. **ASCII (GSM 03.38)** - `data_coding: 0x01`
   - Supports: `@£$¥èéùìòÇ\nØø\rÅå...`
   - Extended chars: `\f^{}\\[~]|€`

2. **LATIN1** - `data_coding: 0x03`
   - ISO-8859-1 character set

3. **UCS2** - `data_coding: 0x08`
   - UTF-16 Big-Endian (universal)

### GSM Shift Tables

The library supports GSM shift tables for locale-specific characters:

```javascript
// GSM Turkish (0x01) - ĞİŞç€ğış
// GSM Spanish (0x02) - ÁÍÓÚá€íóú
// GSM Portuguese (0x03) - ÀÍÓÚÃÕÂ€íóúãõâ
```

### Manual Encoding Control

```javascript
// Change default encoding
smpp.encodings.default = 'LATIN1';

// Remove unsupported encoding
delete smpp.encodings.ASCII;

// Send pre-encoded buffer
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]),
  data_coding: 0x01
});
```

---

## User Data Header (UDH)

For concatenated or special messages:

```javascript
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: {
    udh: Buffer.from([0x05, 0x00, 0x03, 0x01, 0x02, 0x01]), // Concatenation header
    message: 'This is part 1 of a long message...'
  }
});
```

UDH sets `esm_class` automatically with the UDH indicator bit (0x40).

---

## TLV Parameters

Optional parameters supported via TLV (Tag-Length-Value):

```javascript
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: 'Hello!',
  // TLV parameters
  source_port: 1234,
  dest_port: 5678,
  sar_msg_ref_num: 1,      // Segmentation reference
  sar_total_segments: 2,   // Total segments
  sar_segment_seqnum: 1,   // Current segment
  message_payload: Buffer.from('Long message content...')
});
```

### Common TLVs

| TLV | ID | Type | Description |
|-----|----|------|-------------|
| `source_port` | 0x020a | int16 | Source port |
| `dest_port` | 0x020b | int16 | Destination port |
| `sar_msg_ref_num` | 0x020c | int16 | Segmentation reference |
| `sar_total_segments` | 0x020e | int8 | Total segments |
| `sar_segment_seqnum` | 0x020f | int8 | Segment number |
| `message_payload` | 0x0424 | buffer | Extended message content |
| `message_state` | 0x0427 | int8 | Delivery state |
| `receipted_message_id` | 0x001e | cstring | Delivery receipt message ID |

---

## Constants

### Error Codes

```javascript
smpp.ESME_ROK          // 0x0000 - Success
smpp.ESME_RINVCMDID    // 0x0003 - Invalid command ID
smpp.ESME_RBINDFAIL    // 0x000d - Bind failed
smpp.ESME_RINVPASWD    // 0x000e - Invalid password
smpp.ESME_RTHROTTLED   // 0x0058 - Throttled
smpp.ESME_RSUBMITFAIL  // 0x0045 - Submit failed
```

### Type of Number (TON)

```javascript
smpp.TON.UNKNOWN           // 0x00
smpp.TON.INTERNATIONAL     // 0x01
smpp.TON.NATIONAL          // 0x02
smpp.TON.NETWORK_SPECIFIC  // 0x03
smpp.TON.SUBSCRIBER_NUMBER // 0x04
smpp.TON.ALPHANUMERIC      // 0x05
smpp.TON.ABBREVIATED       // 0x06
```

### Numbering Plan Indicator (NPI)

```javascript
smpp.NPI.UNKNOWN     // 0x00
smpp.NPI.ISDN        // 0x01 (E.164)
smpp.NPI.DATA        // 0x03
smpp.NPI.TELEX       // 0x04
smpp.NPI.LAND_MOBILE // 0x06
smpp.NPI.NATIONAL    // 0x08
smpp.NPI.PRIVATE     // 0x09
smpp.NPI.IP          // 0x0e
```

### Message State

```javascript
smpp.MESSAGE_STATE.SCHEDULED     // 0
smpp.MESSAGE_STATE.ENROUTE       // 1
smpp.MESSAGE_STATE.DELIVERED     // 2
smpp.MESSAGE_STATE.EXPIRED       // 3
smpp.MESSAGE_STATE.DELETED       // 4
smpp.MESSAGE_STATE.UNDELIVERABLE // 5
smpp.MESSAGE_STATE.ACCEPTED      // 6
smpp.MESSAGE_STATE.UNKNOWN       // 7
smpp.MESSAGE_STATE.REJECTED      // 8
```

### ESM Class Flags

```javascript
smpp.ESM_CLASS.DATAGRAM               // 0x01
smpp.ESM_CLASS.MC_DELIVERY_RECEIPT    // 0x04
smpp.ESM_CLASS.DELIVERY_ACKNOWLEDGEMENT // 0x08
smpp.ESM_CLASS.USER_ACKNOWLEDGEMENT   // 0x10
smpp.ESM_CLASS.UDH_INDICATOR          // 0x40
smpp.ESM_CLASS.SET_REPLY_PATH         // 0x80
```

---

## Extensibility

### Custom Commands

```javascript
smpp.addCommand('my_custom_command', {
  id: 0x00010001,
  params: {
    custom_field: { type: smpp.types.cstring },
    custom_int: { type: smpp.types.int32 }
  }
});

// Now available as session method
session.my_custom_command({ custom_field: 'value', custom_int: 42 });
```

### Custom TLVs

```javascript
smpp.addTLV('my_custom_tlv', {
  id: 0x1400,
  type: smpp.types.tlv.cstring
});

// Now usable in PDUs
session.submit_sm({
  destination_addr: '+1234567890',
  short_message: 'Hello!',
  my_custom_tlv: 'custom value'
});
```

---

## Proxy Protocol Support

HAProxy Proxy Protocol v1 is supported for deployments behind load balancers:

```javascript
const server = smpp.createServer({
  enable_proxy_protocol_detection: true
}, function(session) {
  console.log('Client IP:', session.remoteAddress);
  console.log('Proxy IP:', session.proxyProtocolProxy.address);
});
```

---

## Complete Examples

### SMS Gateway Client

```javascript
const smpp = require('@semyonf/smpp');

const session = smpp.connect({
  url: 'smpp://smsc.example.com:2775',
  auto_enquire_link_period: 30000
}, function() {
  session.bind_transceiver({
    system_id: 'MY_SYSTEM_ID',
    password: 'MY_PASSWORD'
  }, function(pdu) {
    if (pdu.command_status === 0) {
      console.log('Connected and authenticated');
      sendMessage();
    } else {
      console.error('Bind failed:', pdu.command_status);
    }
  });
});

function sendMessage() {
  session.submit_sm({
    source_addr: 'MYAPP',
    destination_addr: '+1234567890',
    short_message: 'Hello from SMPP!'
  }, function(pdu) {
    if (pdu.command_status === 0) {
      console.log('Message sent, ID:', pdu.message_id);
    }
  });
}

// Handle incoming delivery receipts
session.on('deliver_sm', function(pdu) {
  console.log('Delivery receipt:', pdu);
  session.send(pdu.response());
});

session.on('error', function(err) {
  console.error('Connection error:', err);
});
```

### SMPP Server (SMSC Simulator)

```javascript
const smpp = require('@semyonf/smpp');

const server = smpp.createServer(function(session) {
  session.on('error', function(err) {
    console.error('Session error:', err);
  });

  session.on('bind_transceiver', function(pdu) {
    // Simple authentication
    if (pdu.system_id === 'test' && pdu.password === 'test') {
      session.send(pdu.response());
    } else {
      session.send(pdu.response({
        command_status: smpp.ESME_RBINDFAIL
      }));
      session.close();
    }
  });

  session.on('submit_sm', function(pdu) {
    const messageId = Date.now().toString();
    console.log('Received SMS to:', pdu.destination_addr);
    console.log('Message:', pdu.short_message);

    session.send(pdu.response({
      message_id: messageId
    }));
  });

  session.on('enquire_link', function(pdu) {
    session.send(pdu.response());
  });

  session.on('unbind', function(pdu) {
    session.send(pdu.response());
    session.close();
  });
});

server.listen(2775, function() {
  console.log('SMPP server listening on port 2775');
});
```

### Async Authentication Pattern

```javascript
session.on('bind_transceiver', function(pdu) {
  // Pause to prevent processing while authenticating
  session.pause();

  authenticateUser(pdu.system_id, pdu.password)
    .then(function() {
      session.send(pdu.response());
      session.resume();
    })
    .catch(function(err) {
      session.send(pdu.response({
        command_status: smpp.ESME_RBINDFAIL
      }));
      session.close();
    });
});
```

---

## Testing

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run mutation tests
npm run test:mutation

# Lint
npm run lint

# Format
npm run format
```

---

## Dependencies

- **iconv-lite** (^0.6.3) - Character encoding conversion
- **findhit-proxywrap** (^0.3.12) - Proxy Protocol v1 support

---

## Important Notes

1. **Always handle errors**: Not listening for `error` events will crash the application.

2. **Default ports**: SMPP uses port 2775, secure SMPP uses port 3550.

3. **Connection timeout**: Default is 30 seconds, configurable via `connectTimeout`.

4. **Self-signed certificates**: Allowed by default (`rejectUnauthorized: false`).

5. **Sequence numbers**: Automatically managed, wrap at 0x7FFFFFFF.

6. **PDU max size**: 16384 bytes (configurable via `PDU.maxLength`).

7. **Encoding detection**: Automatic, tries ASCII → LATIN1 → UCS2.

8. **TLV multiple values**: Some TLVs (like `broadcast_area_identifier`) support arrays.

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `lib/smpp.ts` | 812 | Session, Server, connect(), createServer() |
| `lib/pdu.ts` | 244 | PDU class - encode/decode protocol messages |
| `lib/defs.ts` | 747 | Types, encodings, filters, GSM charset |
| `lib/commands.ts` | 313 | 27 SMPP command definitions |
| `lib/tlvs.ts` | 287 | 57 TLV parameter definitions |
| `lib/consts.ts` | 102 | Protocol constants (TON, NPI, ESM_CLASS, etc.) |
| `lib/errors.ts` | 69 | 68 SMPP error codes |
| `lib/index.ts` | 4 | Entry point (re-exports smpp.ts) |
