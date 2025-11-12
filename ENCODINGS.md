# Extending Data Codings in node-smpp

This guide explains how to extend the node-smpp library with custom data codings and character encodings.

## Table of Contents

- [Overview](#overview)
- [Registering Custom Encodings](#registering-custom-encodings)
- [Registering Custom GSM Coders](#registering-custom-gsm-coders)
- [Built-in Encodings](#built-in-encodings)
- [Examples](#examples)

## Overview

The node-smpp library provides a flexible mechanism for extending data codings. You can:

1. **Register custom encodings** - Add support for new character encodings (e.g., UTF-8, custom codepages)
2. **Register custom GSM coders** - Add support for new GSM 03.38 shift tables (e.g., language-specific character sets)

## Registering Custom Encodings

Use the `registerEncoding()` function to add a new encoding to the library.

### API

```typescript
smpp.registerEncoding(name: string, encoding: Encoding): void
```

**Parameters:**
- `name` - The name of the encoding (e.g., 'UTF8', 'CUSTOM')
- `encoding` - An object implementing the `Encoding` interface:
  - `match(value: string): boolean` - Returns true if the value can be encoded with this encoding
  - `encode(value: string): Buffer` - Encodes a string to a Buffer
  - `decode(value: Buffer | string): string` - Decodes a Buffer to a string

### Example: UTF-8 Encoding

```javascript
const smpp = require('smpp');

// Register UTF-8 encoding
smpp.registerEncoding('UTF8', {
  match: (value) => {
    // UTF-8 can encode any string
    return true;
  },
  encode: (value) => {
    return Buffer.from(value, 'utf8');
  },
  decode: (value) => {
    if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
    }
    return String(value);
  }
});

// Use it in your SMPP session
const session = smpp.connect('smpp://localhost:2775');

session.submit_sm({
  destination_addr: '1234567890',
  short_message: {
    message: 'Hello 世界 🌍',
    udh: null
  },
  data_coding: 0x08 // Or use smpp.ENCODING.UCS2
}, (pdu) => {
  console.log('Message sent:', pdu);
});
```

### Example: ISO-8859-2 (Latin-2) Encoding

```javascript
const smpp = require('smpp');
const iconv = require('iconv-lite');

// Register ISO-8859-2 encoding for Central European languages
smpp.registerEncoding('LATIN2', {
  match: (value) => {
    // Check if value can be encoded as Latin-2
    return value === iconv.decode(iconv.encode(value, 'latin2'), 'latin2');
  },
  encode: (value) => {
    return iconv.encode(value, 'latin2');
  },
  decode: (value) => {
    return iconv.decode(value, 'latin2');
  }
});

// Add to constants for easier reference
smpp.consts.ENCODING.LATIN2 = 0x10; // Custom data_coding value

// Set as default encoding
smpp.encodings.default = 'LATIN2';
```

## Registering Custom GSM Coders

Use the `registerGsmCoder()` function to add new GSM 03.38 shift tables.

### API

```typescript
smpp.registerGsmCoder(
  name: string,
  encodingValue: number,
  coderDef: GsmCoderDefinition
): void
```

**Parameters:**
- `name` - The name of the GSM coder (e.g., 'GSM_FR', 'GSM_DE')
- `encodingValue` - The encoding value (0x00-0xFF) used in UDH headers
- `coderDef` - An object implementing the `GsmCoderDefinition` interface:
  - `chars: string` - Standard character set (128 characters)
  - `extChars?: string` - Extended characters (escaped with 0x1B)
  - `escChars?: string` - Escape characters
  - `charRegex: RegExp` - Validation regex for the character set
  - `charListEnc: {}` - Character lookup table for encoding (initialized automatically)
  - `extCharListEnc: {}` - Extended character lookup table for encoding
  - `charListDec: {}` - Character lookup table for decoding
  - `extCharListDec: {}` - Extended character lookup table for decoding

### Example: GSM French Shift Table

```javascript
const smpp = require('smpp');

// Register a hypothetical French GSM shift table
smpp.registerGsmCoder('GSM_FR', 0x04, {
  chars:
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
  extChars: '\f^{}\\[~]|€àâêîô',
  escChars: '\nΛ()/<=>¡eaaaeo',
  charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€àâêîô]*$/,
  charListEnc: {},
  extCharListEnc: {},
  charListDec: {},
  extCharListDec: {}
});

// Add to constants
smpp.consts.ENCODING.GSM_FR = 0x01;

// Use with UDH for language-specific encoding
session.submit_sm({
  destination_addr: '1234567890',
  short_message: {
    message: 'Bonjour! Comment ça va?',
    udh: Buffer.from([0x25, 0x01, 0x04]) // 0x25 = locking shift, 0x04 = French
  },
  data_coding: 0x00 // GSM default
}, (pdu) => {
  console.log('Message sent:', pdu);
});
```

### Example: GSM German Shift Table

```javascript
const smpp = require('smpp');

// Register German GSM shift table with umlauts
smpp.registerGsmCoder('GSM_DE', 0x05, {
  chars:
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜß¿abcdefghijklmnopqrstuvwxyzäöñüà',
  extChars: '\f^{}\\[~]|€',
  escChars: '\nΛ()/<=>¡e',
  charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ߿a-zäöñüà\f^{}\\[~\]|€]*$/,
  charListEnc: {},
  extCharListEnc: {},
  charListDec: {},
  extCharListDec: {}
});

// Add to constants
smpp.consts.ENCODING.GSM_DE = 0x01;
```

## Built-in Encodings

The library comes with the following built-in encodings:

### Standard Encodings

| Name | Data Coding | Description |
|------|-------------|-------------|
| `ASCII` | 0x00 | GSM 03.38 default alphabet |
| `LATIN1` | 0x03 | ISO-8859-1 (Latin-1) |
| `UCS2` | 0x08 | Unicode 16-bit (UTF-16BE) |

### GSM Shift Tables

| Name | UDH Value | Description |
|------|-----------|-------------|
| `GSM` | 0x00 | GSM 03.38 standard |
| `GSM_TR` | 0x01 | Turkish shift table |
| `GSM_ES` | 0x02 | Spanish shift table |
| `GSM_PT` | 0x03 | Portuguese shift table |

## Examples

### Example 1: Auto-detection with Custom Encoding

```javascript
const smpp = require('smpp');

// Register custom encoding
smpp.registerEncoding('CUSTOM', {
  match: (value) => {
    // Custom logic to detect if this encoding should be used
    return /^[a-zA-Z0-9\s]+$/.test(value);
  },
  encode: (value) => {
    return Buffer.from(value.toUpperCase(), 'ascii');
  },
  decode: (value) => {
    return value.toString('ascii');
  }
});

// Send message with automatic encoding detection
session.submit_sm({
  destination_addr: '1234567890',
  short_message: 'Hello World',
  data_coding: null // Auto-detect encoding
}, (pdu) => {
  console.log('Message sent with encoding:', pdu.data_coding);
});
```

### Example 2: Changing Default Encoding

```javascript
const smpp = require('smpp');

// Register UTF-8
smpp.registerEncoding('UTF8', {
  match: (value) => true,
  encode: (value) => Buffer.from(value, 'utf8'),
  decode: (value) => value.toString('utf8')
});

// Set UTF-8 as default
smpp.encodings.default = 'UTF8';

// Now all messages will use UTF-8 by default
session.submit_sm({
  destination_addr: '1234567890',
  short_message: 'Hello 世界',
  data_coding: null // Will use UTF8
}, (pdu) => {
  console.log('Message sent');
});
```

### Example 3: Multiple Custom Encodings

```javascript
const smpp = require('smpp');
const iconv = require('iconv-lite');

// Register multiple custom encodings
const customEncodings = {
  'CP1251': 'windows-1251', // Cyrillic
  'CP1252': 'windows-1252', // Western European
  'CP1256': 'windows-1256', // Arabic
  'SHIFT_JIS': 'shift_jis'  // Japanese
};

Object.entries(customEncodings).forEach(([name, iconvName]) => {
  smpp.registerEncoding(name, {
    match: (value) => {
      try {
        return value === iconv.decode(iconv.encode(value, iconvName), iconvName);
      } catch (e) {
        return false;
      }
    },
    encode: (value) => iconv.encode(value, iconvName),
    decode: (value) => iconv.decode(value, iconvName)
  });

  // Add to constants
  smpp.consts.ENCODING[name] = 0x10 + Object.keys(customEncodings).indexOf(name);
});
```

### Example 4: Custom Encoding with Validation

```javascript
const smpp = require('smpp');

// Register encoding with validation
smpp.registerEncoding('SAFE_ASCII', {
  match: (value) => {
    // Only allow safe ASCII characters
    return /^[\x20-\x7E]*$/.test(value);
  },
  encode: (value) => {
    // Remove unsafe characters before encoding
    const safe = value.replace(/[^\x20-\x7E]/g, '?');
    return Buffer.from(safe, 'ascii');
  },
  decode: (value) => {
    return value.toString('ascii');
  }
});

// Use with automatic fallback
smpp.encodings.default = 'SAFE_ASCII';
```

## TypeScript Support

The library includes full TypeScript support for custom encodings:

```typescript
import smpp, { Encoding, GsmCoderDefinition } from 'smpp';

// Type-safe encoding registration
const myEncoding: Encoding = {
  match: (value: string): boolean => {
    return true;
  },
  encode: (value: string): Buffer => {
    return Buffer.from(value, 'utf8');
  },
  decode: (value: Buffer | string): string => {
    if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
    }
    return String(value);
  }
};

smpp.registerEncoding('MY_ENCODING', myEncoding);

// Type-safe GSM coder registration
const myGsmCoder: GsmCoderDefinition = {
  chars: '...',
  extChars: '...',
  escChars: '...',
  charRegex: /^.+$/,
  charListEnc: {},
  extCharListEnc: {},
  charListDec: {},
  extCharListDec: {}
};

smpp.registerGsmCoder('MY_GSM', 0x04, myGsmCoder);
```

## Advanced Usage

### Encoding Priority

When using auto-detection (`data_coding: null`), encodings are tested in the order they were registered. The first matching encoding is used. To ensure correct priority:

```javascript
// Register in order of specificity (most specific first)
smpp.registerEncoding('CUSTOM_SPECIFIC', specificEncoding);
smpp.registerEncoding('CUSTOM_GENERAL', generalEncoding);
```

### Removing Encodings

You can remove built-in or custom encodings:

```javascript
// Remove an encoding
delete smpp.encodings.LATIN1;

// Replace an encoding
smpp.encodings.ASCII = myCustomAsciiEncoding;
```

### UDH Integration

Custom GSM coders work seamlessly with UDH (User Data Header):

```javascript
// The library automatically detects UDH language shift indicators
// 0x24 = single shift
// 0x25 = locking shift

session.submit_sm({
  destination_addr: '1234567890',
  short_message: {
    message: 'Custom message',
    udh: Buffer.from([0x25, 0x01, 0x04]) // Locking shift to encoding 0x04
  },
  data_coding: 0x00
});
```

## Troubleshooting

### Encoding Not Detected

If your custom encoding is not being auto-detected:

1. Ensure `match()` returns `true` for the expected input
2. Check the registration order - more specific encodings should be registered first
3. Verify the encoding is not being overridden by a later registration

### Character Corruption

If characters are corrupted:

1. Verify the `encode()` and `decode()` functions are inverse operations
2. Check that `charRegex` matches all valid characters
3. Ensure extended characters are properly mapped in GSM coders

### TypeScript Errors

If you encounter TypeScript errors:

1. Ensure you're importing the types: `import { Encoding, GsmCoderDefinition } from 'smpp'`
2. Check that all required interface methods are implemented
3. Verify the function signatures match the interface definitions

## Additional Resources

- [SMPP 3.4 Specification](http://www.smsforum.net/SMPP_v3_4_Issue1_2.zip)
- [GSM 03.38 Character Set](https://en.wikipedia.org/wiki/GSM_03.38)
- [Node.js Buffer API](https://nodejs.org/api/buffer.html)
- [iconv-lite for character encoding](https://github.com/ashtuchkin/iconv-lite)

## Contributing

If you create a useful custom encoding or GSM coder, consider contributing it back to the library by opening a pull request on GitHub.
