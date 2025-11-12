const assert = require('assert');
const smpp = require('..');

describe('Encoding Extensions', function () {
  describe('registerEncoding()', function () {
    it('should register a custom encoding', function () {
      const customEncoding = {
        match: (value) => /^[A-Z]+$/.test(value),
        encode: (value) => Buffer.from(value, 'ascii'),
        decode: (value) => value.toString('ascii'),
      };

      smpp.registerEncoding('UPPERCASE', customEncoding);

      assert.ok(smpp.encodings.UPPERCASE);
      assert.strictEqual(typeof smpp.encodings.UPPERCASE.match, 'function');
      assert.strictEqual(typeof smpp.encodings.UPPERCASE.encode, 'function');
      assert.strictEqual(typeof smpp.encodings.UPPERCASE.decode, 'function');
    });

    it('should use custom encoding for encoding', function () {
      const customEncoding = {
        match: (value) => true,
        encode: (value) => Buffer.from(value.toUpperCase(), 'ascii'),
        decode: (value) => value.toString('ascii').toLowerCase(),
      };

      smpp.registerEncoding('UPPER_LOWER', customEncoding);

      const encoded = smpp.encodings.UPPER_LOWER.encode('hello');
      assert.ok(Buffer.isBuffer(encoded));
      assert.strictEqual(encoded.toString('ascii'), 'HELLO');

      const decoded = smpp.encodings.UPPER_LOWER.decode(encoded);
      assert.strictEqual(decoded, 'hello');
    });

    it('should detect custom encoding', function () {
      const customEncoding = {
        match: (value) => /^\d+$/.test(value),
        encode: (value) => Buffer.from(value, 'ascii'),
        decode: (value) => value.toString('ascii'),
      };

      smpp.registerEncoding('DIGITS_ONLY', customEncoding);

      assert.ok(smpp.encodings.DIGITS_ONLY.match('12345'));
      assert.ok(!smpp.encodings.DIGITS_ONLY.match('abc123'));
    });

    it('should throw error for invalid encoding name', function () {
      assert.throws(
        () => {
          smpp.registerEncoding('', {
            match: () => true,
            encode: () => Buffer.alloc(0),
            decode: () => '',
          });
        },
        /Encoding name must be a non-empty string/
      );

      assert.throws(
        () => {
          smpp.registerEncoding(null, {
            match: () => true,
            encode: () => Buffer.alloc(0),
            decode: () => '',
          });
        },
        /Encoding name must be a non-empty string/
      );
    });

    it('should throw error for invalid encoding object', function () {
      assert.throws(
        () => {
          smpp.registerEncoding('TEST', null);
        },
        /Encoding must be an object/
      );

      assert.throws(
        () => {
          smpp.registerEncoding('TEST', 'not an object');
        },
        /Encoding must be an object/
      );
    });

    it('should throw error for missing match function', function () {
      assert.throws(
        () => {
          smpp.registerEncoding('TEST', {
            encode: () => Buffer.alloc(0),
            decode: () => '',
          });
        },
        /Encoding must have a match\(\) function/
      );
    });

    it('should throw error for missing encode function', function () {
      assert.throws(
        () => {
          smpp.registerEncoding('TEST', {
            match: () => true,
            decode: () => '',
          });
        },
        /Encoding must have an encode\(\) function/
      );
    });

    it('should throw error for missing decode function', function () {
      assert.throws(
        () => {
          smpp.registerEncoding('TEST', {
            match: () => true,
            encode: () => Buffer.alloc(0),
          });
        },
        /Encoding must have a decode\(\) function/
      );
    });

    it('should allow overriding existing encodings', function () {
      const originalAscii = smpp.encodings.ASCII;

      const customAscii = {
        match: (value) => true,
        encode: (value) => Buffer.from('CUSTOM', 'ascii'),
        decode: (value) => 'CUSTOM',
      };

      smpp.registerEncoding('ASCII', customAscii);

      assert.strictEqual(smpp.encodings.ASCII.encode('test').toString('ascii'), 'CUSTOM');
      assert.strictEqual(smpp.encodings.ASCII.decode(Buffer.from('test')), 'CUSTOM');

      // Restore original
      smpp.encodings.ASCII = originalAscii;
    });

    it('should work with UTF-8 encoding', function () {
      const utf8Encoding = {
        match: (value) => true,
        encode: (value) => Buffer.from(value, 'utf8'),
        decode: (value) => {
          if (Buffer.isBuffer(value)) {
            return value.toString('utf8');
          }
          return String(value);
        },
      };

      smpp.registerEncoding('UTF8', utf8Encoding);

      const testString = 'Hello 世界 🌍';
      const encoded = smpp.encodings.UTF8.encode(testString);
      const decoded = smpp.encodings.UTF8.decode(encoded);

      assert.strictEqual(decoded, testString);
    });
  });

  describe('registerGsmCoder()', function () {
    it('should register a custom GSM coder', function () {
      const customCoder = {
        chars:
          '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
        extChars: '\f^{}\\\\[~]|€',
        escChars: '\nΛ()\\/<=>¡e',
        charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
        charListEnc: {},
        extCharListEnc: {},
        charListDec: {},
        extCharListDec: {},
      };

      smpp.registerGsmCoder('GSM_CUSTOM', 0x10, customCoder);

      assert.ok(smpp.gsmCoder.GSM_CUSTOM);
      assert.strictEqual(smpp.gsmCoder.GSM_CUSTOM.chars, customCoder.chars);
    });

    it('should use custom GSM coder for encoding', function () {
      const customCoder = {
        chars:
          '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
        extChars: '\f^{}\\\\[~]|€',
        escChars: '\nΛ()\\/<=>¡e',
        charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
        charListEnc: {},
        extCharListEnc: {},
        charListDec: {},
        extCharListDec: {},
      };

      smpp.registerGsmCoder('GSM_TEST', 0x11, customCoder);

      const encoded = smpp.gsmCoder.encode('Hello', 0x11);
      assert.ok(Buffer.isBuffer(encoded));
      assert.ok(encoded.length > 0);

      const decoded = smpp.gsmCoder.decode(encoded, 0x11);
      assert.strictEqual(decoded, 'Hello');
    });

    it('should initialize lookup tables lazily', function () {
      const customCoder = {
        chars:
          '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
        extChars: '\f^{}\\\\[~]|€',
        escChars: '\nΛ()\\/<=>¡e',
        charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
        charListEnc: {},
        extCharListEnc: {},
        charListDec: {},
        extCharListDec: {},
      };

      smpp.registerGsmCoder('GSM_LAZY', 0x12, customCoder);

      // Lookup tables should be empty
      assert.strictEqual(Object.keys(smpp.gsmCoder.GSM_LAZY.charListEnc).length, 0);

      // Trigger initialization by encoding
      smpp.gsmCoder.encode('A', 0x12);

      // Lookup tables should now be populated
      assert.ok(Object.keys(smpp.gsmCoder.GSM_LAZY.charListEnc).length > 0);
    });

    it('should throw error for invalid GSM coder name', function () {
      assert.throws(
        () => {
          smpp.registerGsmCoder('', 0x10, {
            chars: 'test',
            charRegex: /test/,
            charListEnc: {},
            extCharListEnc: {},
            charListDec: {},
            extCharListDec: {},
          });
        },
        /GSM coder name must be a non-empty string/
      );
    });

    it('should throw error for invalid encoding value', function () {
      assert.throws(
        () => {
          smpp.registerGsmCoder('TEST', -1, {
            chars: 'test',
            charRegex: /test/,
            charListEnc: {},
            extCharListEnc: {},
            charListDec: {},
            extCharListDec: {},
          });
        },
        /Encoding value must be a number between 0 and 255/
      );

      assert.throws(
        () => {
          smpp.registerGsmCoder('TEST', 256, {
            chars: 'test',
            charRegex: /test/,
            charListEnc: {},
            extCharListEnc: {},
            charListDec: {},
            extCharListDec: {},
          });
        },
        /Encoding value must be a number between 0 and 255/
      );
    });

    it('should throw error for invalid GSM coder definition', function () {
      assert.throws(
        () => {
          smpp.registerGsmCoder('TEST', 0x10, null);
        },
        /GSM coder definition must be an object/
      );
    });

    it('should throw error for missing chars property', function () {
      assert.throws(
        () => {
          smpp.registerGsmCoder('TEST', 0x10, {
            charRegex: /test/,
            charListEnc: {},
            extCharListEnc: {},
            charListDec: {},
            extCharListDec: {},
          });
        },
        /GSM coder must have a chars string/
      );
    });

    it('should throw error for missing charRegex property', function () {
      assert.throws(
        () => {
          smpp.registerGsmCoder('TEST', 0x10, {
            chars: 'test',
            charListEnc: {},
            extCharListEnc: {},
            charListDec: {},
            extCharListDec: {},
          });
        },
        /GSM coder must have a charRegex RegExp/
      );
    });

    it('should handle extended characters correctly', function () {
      const customCoder = {
        chars:
          '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
        extChars: '\f^{}\\\\[~]|€',
        escChars: '\nΛ()\\/<=>¡e',
        charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
        charListEnc: {},
        extCharListEnc: {},
        charListDec: {},
        extCharListDec: {},
      };

      smpp.registerGsmCoder('GSM_EXT', 0x13, customCoder);

      // Test with extended character (€)
      const testString = 'Test€';
      const encoded = smpp.gsmCoder.encode(testString, 0x13);
      const decoded = smpp.gsmCoder.decode(encoded, 0x13);

      assert.strictEqual(decoded, testString);
    });

    it('should work with getCoder', function () {
      const customCoder = {
        chars:
          '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
        extChars: '\f^{}\\\\[~]|€',
        escChars: '\nΛ()\\/<=>¡e',
        charRegex: /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
        charListEnc: {},
        extCharListEnc: {},
        charListDec: {},
        extCharListDec: {},
      };

      smpp.registerGsmCoder('GSM_GETCODER', 0x14, customCoder);

      const coder = smpp.gsmCoder.getCoder(0x14);
      assert.ok(coder);
      assert.strictEqual(coder.chars, customCoder.chars);
    });

    it('should initialize lookup tables if not provided', function () {
      const customCoder = {
        chars: 'ABC',
        charRegex: /^[ABC]*$/,
        // Don't provide lookup tables
      };

      smpp.registerGsmCoder('GSM_AUTO', 0x15, customCoder);

      // Lookup tables should be initialized
      assert.ok(smpp.gsmCoder.GSM_AUTO.charListEnc);
      assert.ok(smpp.gsmCoder.GSM_AUTO.extCharListEnc);
      assert.ok(smpp.gsmCoder.GSM_AUTO.charListDec);
      assert.ok(smpp.gsmCoder.GSM_AUTO.extCharListDec);
    });
  });

  describe('Integration tests', function () {
    it('should use custom encoding in message filter', function () {
      // Register a simple custom encoding
      smpp.registerEncoding('SIMPLE', {
        match: (value) => /^[a-z]+$/.test(value),
        encode: (value) => Buffer.from(value, 'ascii'),
        decode: (value) => value.toString('ascii'),
      });

      // Add to constants
      smpp.consts.ENCODING.SIMPLE = 0x20;

      // Test encoding through filter
      const context = { data_coding: 0x20 };
      const encoded = smpp.filters.message.encode.call(context, 'hello');

      assert.ok(Buffer.isBuffer(encoded));
      assert.strictEqual(encoded.toString('ascii'), 'hello');
    });

    it('should use custom encoding with auto-detection', function () {
      // Register encoding that matches numbers
      smpp.registerEncoding('NUMBERS', {
        match: (value) => /^\d+$/.test(value),
        encode: (value) => Buffer.from('NUM:' + value, 'ascii'),
        decode: (value) => value.toString('ascii').replace('NUM:', ''),
      });

      // The encoding should be detected
      assert.ok(smpp.encodings.NUMBERS.match('12345'));
      assert.ok(!smpp.encodings.NUMBERS.match('abc'));
    });

    it('should handle multiple custom encodings', function () {
      const encodings = [
        {
          name: 'ALPHA',
          match: (v) => /^[a-zA-Z]+$/.test(v),
          encode: (v) => Buffer.from(v, 'ascii'),
          decode: (v) => v.toString('ascii'),
        },
        {
          name: 'NUMERIC',
          match: (v) => /^\d+$/.test(v),
          encode: (v) => Buffer.from(v, 'ascii'),
          decode: (v) => v.toString('ascii'),
        },
        {
          name: 'ALPHANUMERIC',
          match: (v) => /^[a-zA-Z0-9]+$/.test(v),
          encode: (v) => Buffer.from(v, 'ascii'),
          decode: (v) => v.toString('ascii'),
        },
      ];

      encodings.forEach((enc) => {
        smpp.registerEncoding(enc.name, {
          match: enc.match,
          encode: enc.encode,
          decode: enc.decode,
        });
      });

      assert.ok(smpp.encodings.ALPHA);
      assert.ok(smpp.encodings.NUMERIC);
      assert.ok(smpp.encodings.ALPHANUMERIC);
    });
  });
});
