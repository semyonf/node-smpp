import iconv from 'iconv-lite';
import { consts } from './consts';

/**
 * Interface for custom encoding implementations
 */
export interface Encoding {
  /**
   * Test if a value matches this encoding's character set
   * @param value - The string to test
   * @returns true if the value can be encoded with this encoding
   */
  match: (value: string) => boolean;

  /**
   * Encode a string to a buffer using this encoding
   * @param value - The string to encode
   * @returns The encoded buffer
   */
  encode: (value: string) => Buffer;

  /**
   * Decode a buffer to a string using this encoding
   * @param value - The buffer to decode
   * @returns The decoded string
   */
  decode: (value: Buffer | string) => string;
}

/**
 * Interface for GSM coder definitions
 */
export interface GsmCoderDefinition {
  /**
   * Standard character set (128 characters)
   */
  chars: string;

  /**
   * Extended characters (escaped with 0x1B)
   */
  extChars?: string;

  /**
   * Extended characters for encoding (if different from extChars)
   */
  extCharsEnc?: string;

  /**
   * Extended characters for decoding (if different from extChars)
   */
  extCharsDec?: string;

  /**
   * Escape characters for encoding
   */
  escChars?: string;

  /**
   * Escape characters for encoding (if different from escChars)
   */
  escCharsEnc?: string;

  /**
   * Escape characters for decoding (if different from escChars)
   */
  escCharsDec?: string;

  /**
   * Regular expression to validate if a string can be encoded with this coder
   */
  charRegex: RegExp;

  /**
   * Character lookup table for encoding (initialized lazily)
   */
  charListEnc: { [key: string]: number };

  /**
   * Extended character lookup table for encoding (initialized lazily)
   */
  extCharListEnc: { [key: string]: string };

  /**
   * Character lookup table for decoding (initialized lazily)
   */
  charListDec: { [key: number]: string };

  /**
   * Extended character lookup table for decoding (initialized lazily)
   */
  extCharListDec: { [key: string]: string };
}

const int8 = {
  read: function (buffer, offset) {
    return buffer.readUInt8(offset);
  },
  write: function (value, buffer, offset) {
    value = value || 0;
    buffer.writeUInt8(value, offset);
  },
  size: function () {
    return 1;
  },
  default: 0,
} as const;

const int16 = {
  read: function (buffer, offset) {
    return buffer.readUInt16BE(offset);
  },
  write: function (value, buffer, offset) {
    value = value || 0;
    buffer.writeUInt16BE(value, offset);
  },
  size: function () {
    return 2;
  },
  default: 0,
} as const;

const int32 = {
  read: function (buffer, offset) {
    return buffer.readUInt32BE(offset);
  },
  write: function (value, buffer, offset) {
    value = value || 0;
    buffer.writeUInt32BE(value, offset);
  },
  size: function () {
    return 4;
  },
  default: 0,
} as const;

const string = {
  read: function (buffer, offset) {
    const length = buffer.readUInt8(offset++);
    return buffer.toString('ascii', offset, offset + length);
  },
  write: function (value, buffer, offset) {
    if (!Buffer.isBuffer(value)) {
      value = Buffer.from(String(value), 'ascii');
    }
    buffer.writeUInt8(value.length, offset++);
    value.copy(buffer, offset);
  },
  size: function (value) {
    return (value.length || String(value).length) + 1;
  },
  default: '',
} as const;

const cstring = {
  read: function (buffer, offset) {
    let length = 0;
    while (buffer[offset + length]) {
      length++;
    }
    return buffer.toString('ascii', offset, offset + length);
  },
  write: function (value, buffer, offset) {
    if (!Buffer.isBuffer(value)) {
      value = Buffer.from(String(value), 'ascii');
    }
    value.copy(buffer, offset);
    buffer[offset + value.length] = 0;
  },
  size: function (value) {
    return (value.length || String(value).length) + 1;
  },
  default: '',
} as const;

const buffer = {
  read: function (buffer, offset) {
    const length = buffer.readUInt8(offset++);
    return buffer.slice(offset, offset + length);
  },
  write: function (value, buffer, offset) {
    buffer.writeUInt8(value.length, offset++);
    if (typeof value == 'string') {
      value = Buffer.from(value, 'ascii');
    }
    value.copy(buffer, offset);
  },
  size: function (value) {
    return value.length + 1;
  },
  default: Buffer.alloc(0),
} as const;

const dest_address_array = {
  read: function (buffer, offset) {
    let dest_address,
      dest_flag,
      result = [];
    let number_of_dests = buffer.readUInt8(offset++);
    while (number_of_dests-- > 0) {
      dest_flag = buffer.readUInt8(offset++);
      if (dest_flag == 1) {
        dest_address = {
          dest_addr_ton: buffer.readUInt8(offset++),
          dest_addr_npi: buffer.readUInt8(offset++),
          destination_addr: types.cstring.read(buffer, offset),
        };
        offset += types.cstring.size(dest_address.destination_addr);
      } else {
        dest_address = {
          dl_name: types.cstring.read(buffer, offset),
        };
        offset += types.cstring.size(dest_address.dl_name);
      }
      result.push(dest_address);
    }
    return result;
  },
  write: function (value, buffer, offset) {
    buffer.writeUInt8(value.length, offset++);
    value.forEach(function (dest_address) {
      if ('dl_name' in dest_address) {
        buffer.writeUInt8(2, offset++);
        types.cstring.write(dest_address.dl_name, buffer, offset);
        offset += types.cstring.size(dest_address.dl_name);
      } else {
        buffer.writeUInt8(1, offset++);
        buffer.writeUInt8(dest_address.dest_addr_ton || 0, offset++);
        buffer.writeUInt8(dest_address.dest_addr_npi || 0, offset++);
        types.cstring.write(dest_address.destination_addr, buffer, offset);
        offset += types.cstring.size(dest_address.destination_addr);
      }
    });
  },
  size: function (value) {
    let size = 1;
    value.forEach(function (dest_address) {
      if ('dl_name' in dest_address) {
        size += types.cstring.size(dest_address.dl_name) + 1;
      } else {
        size += types.cstring.size(dest_address.destination_addr) + 3;
      }
    });
    return size;
  },
  default: [],
} as const;

const unsuccess_sme_array = {
  read: function (buffer, offset) {
    let unsuccess_sme,
      result = [];
    let no_unsuccess = buffer.readUInt8(offset++);
    while (no_unsuccess-- > 0) {
      unsuccess_sme = {
        dest_addr_ton: buffer.readUInt8(offset++),
        dest_addr_npi: buffer.readUInt8(offset++),
        destination_addr: types.cstring.read(buffer, offset),
      };
      offset += types.cstring.size(unsuccess_sme.destination_addr);
      unsuccess_sme.error_status_code = buffer.readUInt32BE(offset);
      offset += 4;
      result.push(unsuccess_sme);
    }
    return result;
  },
  write: function (value, buffer, offset) {
    buffer.writeUInt8(value.length, offset++);
    value.forEach(function (unsuccess_sme) {
      buffer.writeUInt8(unsuccess_sme.dest_addr_ton || 0, offset++);
      buffer.writeUInt8(unsuccess_sme.dest_addr_npi || 0, offset++);
      types.cstring.write(unsuccess_sme.destination_addr, buffer, offset);
      offset += types.cstring.size(unsuccess_sme.destination_addr);
      buffer.writeUInt32BE(unsuccess_sme.error_status_code, offset);
      offset += 4;
    });
  },
  size: function (value) {
    let size = 1;
    value.forEach(function (unsuccess_sme) {
      size += types.cstring.size(unsuccess_sme.destination_addr) + 6;
    });
    return size;
  },
  default: [],
} as const;

const types = {
  int8,
  int16,
  int32,
  string,
  cstring,
  buffer,
  dest_address_array,
  unsuccess_sme_array,
  tlv: {
    int8,
    int16,
    int32,
    cstring,
    string: {
      read: function (buffer, offset, length) {
        return buffer.toString('ascii', offset, offset + length);
      },
      write: function (value, buffer, offset) {
        if (typeof value == 'string') {
          value = Buffer.from(value, 'ascii');
        }
        value.copy(buffer, offset);
      },
      size: function (value) {
        return value.length;
      },
      default: '',
    },
    buffer: {
      read: function (buffer, offset, length) {
        return buffer.slice(offset, offset + length);
      },
      write: function (value, buffer, offset) {
        if (typeof value == 'string') {
          value = Buffer.from(value, 'ascii');
        }
        value.copy(buffer, offset);
      },
      size: function (value) {
        return value.length;
      },
      default: null,
    },
  },
} as const;

const gsmCoder: {
  [key: string]: any;
  GSM: GsmCoderDefinition;
  GSM_TR: GsmCoderDefinition;
  GSM_ES: GsmCoderDefinition;
  GSM_PT: GsmCoderDefinition;
  encode: (string: string, encoding: number) => Buffer;
  decode: (string: Buffer | string, encoding: number) => string;
  getCoder: (encoding: number) => GsmCoderDefinition;
  detect: (string: string) => number | undefined;
} = {
  // GSM 03.38
  GSM: {
    chars:
      '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
    extChars: '\f^{}\\\\[~]|€',
    escChars: '\nΛ()\\/<=>¡e',
    charRegex:
      /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f^{}\\[~\]|€]*$/,
    charListEnc: {},
    extCharListEnc: {},
    charListDec: {},
    extCharListDec: {},
  },
  // GSM 03.38 Turkish Shift Table
  GSM_TR: {
    chars:
      '@£$¥€éùıòÇ\nĞğ\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BŞşßÉ !"#¤%&\'()*+,-./0123456789:;<=>?İABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§çabcdefghijklmnopqrstuvwxyzäöñüà',
    extCharsEnc: '\f^{}\\\\[~]|',
    escCharsEnc: '\nΛ()\\/<=>İ',
    extCharsDec: '\f^{}\\[~]|ĞİŞç€ğış',
    escCharsDec: '\nΛ()/<=>İGIScegis',
    charRegex:
      /^[@£$¥€éùıòÇ\nĞğ\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BŞşßÉ !"#¤%&\'()*+,-./0-9:;<=>?İA-ZÄÖÑÜ§ça-zäöñüà\f^{}\\[~\]|ĞİŞç€ğış]*$/,
    charListEnc: {},
    extCharListEnc: {},
    charListDec: {},
    extCharListDec: {},
  },
  // GSM 03.38 Spanish Shift Table
  GSM_ES: {
    chars:
      '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
    extChars: 'ç\f^{}\\\\[~]|ÁÍÓÚá€íóú',
    escChars: 'Ç\nΛ()\\/<=>¡AIOUaeiou',
    charRegex:
      /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüàç\f^{}\\[~\]|ÁÍÓÚá€íóú]*$/,
    charListEnc: {},
    extCharListEnc: {},
    charListDec: {},
    extCharListDec: {},
  },
  // GSM 03.38 Portuguese Shift Table
  GSM_PT: {
    chars:
      '@£$¥êéúíóç\nÔô\rÁáΔ_ªÇÀ∞^\\€Ó|\x1BÂâÊÉ !"#º%&\'()*+,-./0123456789:;<=>?ÍABCDEFGHIJKLMNOPQRSTUVWXYZÃÕÚÜ§~abcdefghijklmnopqrstuvwxyzãõ`üà',
    extCharsEnc: '\fΦΓ^ΩΠΨΣΘ{}\\\\[~]|',
    escCharsEnc: '\nªÇÀ∞^\\€Ó()\\/<=>Í',
    extCharsDec: 'êç\fÔôÁáΦΓ^ΩΠ ΨΣΘÊ{}\\[~]|ÀÍÓÚÃÕÂ€íóúãõâ',
    escCharsDec: 'éç\nÔôÁáªÇÀ∞^\\\\€ÓÉ()/<=>ÍAIOUÃÕaeiouãõà',
    charRegex:
      /^[@£$¥êéúíóç\nÔô\rÁáΔ_ªÇÀ∞^\\€Ó|\x1BÂâÊÉ !"#º%&\'()*+,-./0-9:;<=>?ÍA-ZÃÕÚÜ§~a-zãõ`üàêç\fÔôÁáΦΓ^ΩΠΨΣΘÊ{}\\[~\]|ÀÍÓÚÃÕÂ€íóúãõâ]*$/,
    charListEnc: {},
    extCharListEnc: {},
    charListDec: {},
    extCharListDec: {},
  },
  encode: function (string, encoding) {
    const coder = this.getCoder(encoding);
    const extCharsEnc = coder.extCharsEnc || coder.extChars;
    const extCharRegex = new RegExp('[' + extCharsEnc.replace(']', '\\]') + ']', 'g');

    string = string.replace(extCharRegex, function (match) {
      return '\x1B' + coder.extCharListEnc[match];
    });

    const result = [];

    for (let i = 0; i < string.length; i++) {
      result.push(string[i] in coder.charListEnc ? coder.charListEnc[string[i]] : '\x20');
    }

    return Buffer.from(result);
  },
  decode: function (string, encoding) {
    const coder = this.getCoder(encoding);
    const escCharsDec = coder.escCharsDec || coder.escChars;
    const escCharRegex = new RegExp('\x1B([' + escCharsDec + '])', 'g');
    let result = '';

    for (let i = 0; i < string.length; i++) {
      result += coder.charListDec[string[i]] || ' ';
    }

    return result.replace(escCharRegex, function (match, p1) {
      return coder.extCharListDec[p1];
    });
  },
  getCoder: function (encoding) {
    let coder = this.GSM;
    switch (encoding) {
      case 0x01:
        coder = this.GSM_TR;
        break;
      case 0x02:
        coder = this.GSM_ES;
        break;
      case 0x03:
        coder = this.GSM_PT;
        break;
    }

    if (Object.keys(coder.charListEnc).length === 0) {
      for (var i = 0; i < coder.chars.length; i++) {
        coder.charListEnc[coder.chars[i]] = i;
        coder.charListDec[i] = coder.chars[i];
      }

      const extCharsEnc = coder.extCharsEnc || coder.extChars;
      const escCharsEnc = coder.escCharsEnc || coder.escChars;
      for (var i = 0; i < extCharsEnc.length; i++) {
        coder.extCharListEnc[extCharsEnc[i]] = escCharsEnc[i];
      }

      const extCharsDec = coder.extCharsDec || coder.extChars;
      const escCharsDec = coder.escCharsDec || coder.escChars;
      for (var i = 0; i < escCharsDec.length; i++) {
        coder.extCharListDec[escCharsDec[i]] = extCharsDec[i];
      }
    }

    return coder;
  },
  detect: function (string) {
    if (gsmCoder.GSM_ES.charRegex.test(string)) {
      return 0x02;
    }

    if (gsmCoder.GSM_PT.charRegex.test(string)) {
      return 0x03;
    }

    if (gsmCoder.GSM_TR.charRegex.test(string)) {
      return 0x01;
    }

    if (gsmCoder.GSM.charRegex.test(string)) {
      return 0x00;
    }

    return undefined;
  },
};

const encodings: {
  [key: string]: any;
  ASCII: Encoding;
  LATIN1: Encoding;
  UCS2: Encoding;
  default: string;
  detect: (value: string) => string | false;
} = {
  ASCII: {
    // GSM 03.38
    match: function (value) {
      return gsmCoder.GSM.charRegex.test(value);
    },
    encode: function (value) {
      return gsmCoder.encode(value, 0x00);
    },
    decode: function (value) {
      return gsmCoder.decode(value, 0x00);
    },
  },
  LATIN1: {
    match: function (value) {
      return value === iconv.decode(iconv.encode(value, 'latin1'), 'latin1');
    },
    encode: function (value) {
      return iconv.encode(value, 'latin1');
    },
    decode: function (value) {
      if (typeof value === 'string') {
        value = Buffer.from(value, 'latin1');
      }
      return iconv.decode(value, 'latin1');
    },
  },
  UCS2: {
    match: function (value) {
      return true;
    },
    encode: function (value) {
      return iconv.encode(value, 'utf16-be');
    },
    decode: function (value) {
      if (typeof value === 'string') {
        value = iconv.encode(value, 'utf16-be');
      }
      return iconv.decode(value, 'utf16-be');
    },
  },
  default: 'ASCII' as string,
  detect: function (value) {
    for (const key in encodings) {
      if (encodings[key].match && encodings[key].match(value)) {
        return key;
      }
    }

    return false;
  },
};

const udhCoder = {
  getUdh: function (buffer: Buffer): Array<any> {
    const bufferLength = buffer.length;

    if (bufferLength <= 1) {
      return [];
    }

    const udhList = [];

    let cursor = 1;
    do {
      const udhLength = buffer[cursor + 1] + 2;
      udhList.push(buffer.slice(cursor, cursor + udhLength));
      cursor += udhLength;
    } while (cursor < bufferLength);

    return udhList;
  },
} as const;

const filters = {
  message: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      let message = typeof value === 'string' ? value : value.message;
      if (typeof message === 'string' && message) {
        let encoded = false;
        if (value.udh) {
          const udhList = udhCoder.getUdh(value.udh);
          for (let i = 0; i < udhList.length; i++) {
            const udh = udhList[i];
            if (udh[0] === 0x24 || udh[0] === 0x25) {
              this.data_coding = consts.ENCODING.ASCII;
              message = gsmCoder.encode(message, udh[2]);
              encoded = true;
              break;
            }
          }
        }
        if (!encoded) {
          let encoding = encodings.default;
          if (this.data_coding === null) {
            // @ts-expect-error some weirdness here
            encoding = encodings.detect(message);
            this.data_coding = consts.ENCODING[encoding];
          } else if (this.data_coding !== consts.ENCODING.SMSC_DEFAULT) {
            for (const key in consts.ENCODING) {
              if (consts.ENCODING[key] === this.data_coding) {
                encoding = key;
                break;
              }
            }
          }
          message = encodings[encoding].encode(message);
        }
      }
      if (!value.udh || !value.udh.length) {
        return message;
      }
      if ('esm_class' in this) {
        this.esm_class = this.esm_class | consts.ESM_CLASS.UDH_INDICATOR;
      }
      return Buffer.concat([value.udh, message]);
    },
    decode: function (value, skipUdh) {
      if (!Buffer.isBuffer(value) || !('data_coding' in this)) {
        return value;
      }
      let encoding = this.data_coding & 0x0f;
      if (!encoding) {
        // @ts-expect-error some weirdness here
        encoding = encodings.default;
      } else {
        for (const key in consts.ENCODING) {
          if (consts.ENCODING[key] == encoding) {
            // @ts-expect-error some weirdness here
            encoding = key;
            break;
          }
        }
      }
      const udhi =
        this.esm_class & (consts.ESM_CLASS.UDH_INDICATOR || consts.ESM_CLASS.KANNEL_UDH_INDICATOR);
      const result = {};
      if (!skipUdh && value.length && udhi) {
        result['udh'] = udhCoder.getUdh(value.slice(0, value[0] + 1));
        result['message'] = value.slice(value[0] + 1);
      } else {
        result['message'] = value;
      }
      if (result['udh'] && (encoding === consts.ENCODING.SMSC_DEFAULT || consts.ENCODING.ASCII)) {
        let decoded = false;
        for (let i = 0; i < result['udh'].length; i++) {
          const udh = result['udh'][i];
          if (udh[0] === 0x24 || udh[0] === 0x25) {
            result['message'] = gsmCoder.decode(result['message'], udh[2]);
            decoded = true;
            break;
          }
        }
        if (!decoded && encodings[encoding]) {
          result['message'] = encodings[encoding].decode(result['message']);
        }
      } else if (encodings[encoding]) {
        result['message'] = encodings[encoding].decode(result['message']);
      }
      return result;
    },
  },
  callback_num: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      const result = Buffer.alloc(value.number.length + 3);
      result.writeUInt8(value.digit_mode || 0, 0);
      result.writeUInt8(value.ton || 0, 1);
      result.writeUInt8(value.npi || 0, 2);
      result.write(value.number, 3, 'ascii');
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      return {
        digit_mode: value.readUInt8(0),
        ton: value.readUInt8(1),
        npi: value.readUInt8(2),
        number: value.toString('ascii', 3),
      };
    },
  },
  broadcast_frequency_interval: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      const result = Buffer.alloc(3);
      result.writeUInt8(value.unit, 0);
      result.writeUInt16BE(value.interval, 1);
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      return {
        unit: value.readUInt8(0),
        interval: value.readUInt16BE(1),
      };
    },
  },
  broadcast_content_type: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      const result = Buffer.alloc(3);
      result.writeUInt8(value.network, 0);
      result.writeUInt16BE(value.content_type, 1);
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      return {
        network: value.readUInt8(0),
        content_type: value.readUInt16BE(1),
      };
    },
  },
  billing_identification: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      const result = Buffer.alloc(value.data.length + 1);
      result.writeUInt8(value.format, 0);
      value.data.copy(result, 1);
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      return {
        format: value.readUInt8(0),
        data: value.slice(1),
      };
    },
  },
  broadcast_area_identifier: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      if (typeof value == 'string') {
        value = {
          format: consts.BROADCAST_AREA_FORMAT.NAME,
          data: value,
        };
      }
      if (typeof value.data == 'string') {
        value.data = Buffer.from(value.data, 'ascii');
      }
      const result = Buffer.alloc(value.data.length + 1);
      result.writeUInt8(value.format, 0);
      value.data.copy(result, 1);
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      const result = {
        format: value.readUInt8(0),
        data: value.slice(1),
      };
      if (result.format == consts.BROADCAST_AREA_FORMAT.NAME) {
        result.data = Buffer.from(result.data.toString('ascii'));
      }
      return result;
    },
  },
  time: {
    encode: function (value) {
      if (!value) {
        return value;
      }
      if (typeof value == 'string') {
        if (value.length <= 12) {
          value = ('000000000000' + value).substr(-12) + '000R';
        }
        return value;
      }
      if (value instanceof Date) {
        let result = value.getUTCFullYear().toString().substr(-2);
        result += ('0' + (value.getUTCMonth() + 1)).substr(-2);
        result += ('0' + value.getUTCDate()).substr(-2);
        result += ('0' + value.getUTCHours()).substr(-2);
        result += ('0' + value.getUTCMinutes()).substr(-2);
        result += ('0' + value.getUTCSeconds()).substr(-2);
        result += ('00' + value.getUTCMilliseconds()).substr(-3, 1);
        result += '00+';
        return result;
      }
      return value;
    },
    decode: function (value) {
      if (!value || typeof value != 'string') {
        return value;
      }
      if (value.substr(-1) == 'R') {
        var result = new Date();
        var match = value.match(/^(..)(..)(..)(..)(..)(..).*$/);
        ['FullYear', 'Month', 'Date', 'Hours', 'Minutes', 'Seconds'].forEach(function (method, i) {
          result['set' + method](result['get' + method]() + +match[++i]);
        });
        return result;
      }
      const century = ('000' + new Date().getUTCFullYear()).substr(-4, 2);
      var result = new Date(
        value.replace(/^(..)(..)(..)(..)(..)(..)(.)?.*$/, century + '$1-$2-$3 $4:$5:$6:$700 UTC')
      );
      var match = value.match(/(..)([-+])$/);
      if (match && match[1] != '00') {
        let diff = Number(match[1]) * 15;
        if (match[2] == '+') {
          diff = -diff;
        }
        result.setMinutes(result.getMinutes() + diff);
      }
      return result;
    },
  },
  callback_num_atag: {
    encode: function (value) {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      const result = Buffer.alloc(value.display.length + 1);
      result.writeUInt8(value.encoding, 0);
      if (typeof value.display == 'string') {
        value.display = Buffer.from(value.display, 'ascii');
      }
      value.display.copy(result, 1);
      return result;
    },
    decode: function (value) {
      if (!Buffer.isBuffer(value)) {
        return value;
      }
      return {
        encoding: value.readUInt8(0),
        display: value.slice(1),
      };
    },
  },
} as const;

/**
 * Register a custom encoding
 *
 * @param name - The name of the encoding (e.g., 'UTF8', 'CUSTOM')
 * @param encoding - The encoding implementation
 *
 * @example
 * ```typescript
 * import smpp from 'smpp';
 *
 * // Register a custom UTF-8 encoding
 * smpp.registerEncoding('UTF8', {
 *   match: (value) => {
 *     // Check if value can be encoded as UTF-8
 *     return Buffer.byteLength(value, 'utf8') === value.length;
 *   },
 *   encode: (value) => {
 *     return Buffer.from(value, 'utf8');
 *   },
 *   decode: (value) => {
 *     return value.toString('utf8');
 *   }
 * });
 *
 * // Set as default encoding
 * smpp.encodings.default = 'UTF8';
 * ```
 */
export function registerEncoding(name: string, encoding: Encoding): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Encoding name must be a non-empty string');
  }

  if (!encoding || typeof encoding !== 'object') {
    throw new Error('Encoding must be an object');
  }

  if (typeof encoding.match !== 'function') {
    throw new Error('Encoding must have a match() function');
  }

  if (typeof encoding.encode !== 'function') {
    throw new Error('Encoding must have an encode() function');
  }

  if (typeof encoding.decode !== 'function') {
    throw new Error('Encoding must have a decode() function');
  }

  encodings[name] = encoding;
}

/**
 * Register a custom GSM coder
 *
 * @param name - The name of the GSM coder (e.g., 'GSM_FR', 'GSM_DE')
 * @param encodingValue - The encoding value (0x00-0xFF) used in UDH headers
 * @param coderDef - The GSM coder definition
 *
 * @example
 * ```typescript
 * import smpp from 'smpp';
 *
 * // Register a custom GSM French shift table
 * smpp.registerGsmCoder('GSM_FR', 0x04, {
 *   chars: '@£$¥èéùìòÇ\nØø\rÅå...', // 128 standard characters
 *   extChars: '\f^{}[~]|€',          // Extended characters
 *   escChars: '\nΛ()/<=>¡e',          // Escape characters
 *   charRegex: /^[...]*$/,            // Validation regex
 *   charListEnc: {},
 *   extCharListEnc: {},
 *   charListDec: {},
 *   extCharListDec: {}
 * });
 * ```
 */
export function registerGsmCoder(
  name: string,
  encodingValue: number,
  coderDef: GsmCoderDefinition
): void {
  if (!name || typeof name !== 'string') {
    throw new Error('GSM coder name must be a non-empty string');
  }

  if (typeof encodingValue !== 'number' || encodingValue < 0 || encodingValue > 255) {
    throw new Error('Encoding value must be a number between 0 and 255');
  }

  if (!coderDef || typeof coderDef !== 'object') {
    throw new Error('GSM coder definition must be an object');
  }

  if (typeof coderDef.chars !== 'string') {
    throw new Error('GSM coder must have a chars string');
  }

  if (!(coderDef.charRegex instanceof RegExp)) {
    throw new Error('GSM coder must have a charRegex RegExp');
  }

  // Initialize lookup tables if not provided
  if (!coderDef.charListEnc) {
    coderDef.charListEnc = {};
  }
  if (!coderDef.extCharListEnc) {
    coderDef.extCharListEnc = {};
  }
  if (!coderDef.charListDec) {
    coderDef.charListDec = {};
  }
  if (!coderDef.extCharListDec) {
    coderDef.extCharListDec = {};
  }

  // Add to gsmCoder
  gsmCoder[name] = coderDef;

  // Update getCoder to handle this encoding value
  const originalGetCoder = gsmCoder.getCoder;
  gsmCoder.getCoder = function (encoding: number) {
    if (encoding === encodingValue) {
      const coder = gsmCoder[name];

      // Lazy initialization of lookup tables
      if (Object.keys(coder.charListEnc).length === 0) {
        for (var i = 0; i < coder.chars.length; i++) {
          coder.charListEnc[coder.chars[i]] = i;
          coder.charListDec[i] = coder.chars[i];
        }

        const extCharsEnc = coder.extCharsEnc || coder.extChars;
        const escCharsEnc = coder.escCharsEnc || coder.escChars;
        if (extCharsEnc && escCharsEnc) {
          for (var i = 0; i < extCharsEnc.length; i++) {
            coder.extCharListEnc[extCharsEnc[i]] = escCharsEnc[i];
          }
        }

        const extCharsDec = coder.extCharsDec || coder.extChars;
        const escCharsDec = coder.escCharsDec || coder.escChars;
        if (extCharsDec && escCharsDec) {
          for (var i = 0; i < escCharsDec.length; i++) {
            coder.extCharListDec[escCharsDec[i]] = extCharsDec[i];
          }
        }
      }

      return coder;
    }
    return originalGetCoder.call(this, encoding);
  };
}

export { errors } from './errors';
export { encodings };
export { filters };
export { gsmCoder };
export { consts } from './consts';
export { commands, commandsById } from './commands';
export { types };
export { tlvs, tlvsById } from './tlvs';
