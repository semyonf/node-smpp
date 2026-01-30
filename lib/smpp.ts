import net from 'net';
import tls from 'tls';
import util from 'util';
import { parse } from 'url';
import * as defs from './defs';
import { PDU } from './pdu';
import { EventEmitter } from 'events';
import { SessionEventMap, AnyPDU } from './types';

const proxy = require('findhit-proxywrap').proxy;

const proxyTransport = proxy(net, {
  strict: false,
  ignoreStrictExceptions: true,
});
const proxyTlsTransport = proxy(tls, {
  strict: false,
  ignoreStrictExceptions: true,
});

// ========== Type Definitions ==========

/**
 * Debug listener callback type
 */
export type DebugListener = (type: string | null, msg: string | null, payload?: any) => void;

/**
 * Options for creating a client session via connect()
 */
export interface ConnectOptions {
  /** Server hostname */
  host?: string;
  /** Server port (default: 2775, or 3550 for TLS) */
  port?: number;
  /** Enable TLS connection */
  tls?: boolean;
  /** Verify TLS certificate (default: false to allow self-signed) */
  rejectUnauthorized?: boolean;
  /** Connection timeout in milliseconds (default: 30000) */
  connectTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom debug listener function */
  debugListener?: DebugListener;
  /** Auto-send enquire_link at this interval (milliseconds) */
  auto_enquire_link_period?: number;
  /** Alternative: connection URL (smpp://host:port or ssmpp://host:port for TLS) */
  url?: string;
  /** Additional options passed to net.connect or tls.connect */
  [key: string]: any;
}

/**
 * Options for creating a server session (internal use)
 */
export interface SessionOptions extends ConnectOptions {
  /** Existing socket for server mode */
  socket?: net.Socket | tls.TLSSocket;
}

/**
 * Options for creating an SMPP server
 */
export interface ServerOptions {
  /** TLS private key (enables TLS when provided with cert) */
  key?: Buffer | string;
  /** TLS certificate (enables TLS when provided with key) */
  cert?: Buffer | string;
  /** Enable PROXY protocol detection */
  enable_proxy_protocol_detection?: boolean;
  /** Mark server as proxied (internal use) */
  isProxiedServer?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom debug listener function */
  debugListener?: DebugListener;
  /** Auto-prepend buffer for testing (internal use) */
  autoPrependBuffer?: Buffer;
  /** Additional options passed to net.Server or tls.Server */
  [key: string]: any;
}

/**
 * Callback for PDU responses
 */
export type PDUResponseCallback = (pdu: PDU) => void;

/**
 * Callback when PDU is sent
 */
export type PDUSendCallback = (pdu: PDU) => void;

/**
 * Callback when PDU send fails
 */
export type PDUFailureCallback = (pdu: PDU, error?: Error) => void;

/**
 * Session event listener callback
 */
export type SessionListener = (session: Session) => void;

/**
 * Metrics event payload
 */
export interface MetricsPayload {
  mode: string | null;
  remoteAddress: string | null;
  remotePort: number | null;
  remoteTls: boolean;
  sessionId: number | null;
  session: Session;
}

type PDUMethods = {
  [CommandName in keyof typeof defs.commands]: (
    params?: any,
    responseCallback?: PDUResponseCallback,
    sendCallback?: PDUSendCallback,
    failureCallback?: PDUFailureCallback
  ) => boolean;
};

export interface Session extends PDUMethods {}

export class Session extends EventEmitter {
  private sequence: number = 0;
  private paused: boolean = false;
  private closed: boolean = false;
  public remoteAddress: string | null = null;
  public remotePort: number | null = null;
  public proxyProtocolProxy: any = null;
  private _busy: boolean = false;
  private _callbacks = {};
  private _interval: NodeJS.Timeout | 0 = 0;
  private _command_length: number | null = null;
  private _mode: string | null = null;
  private _id: number = Math.floor(Math.random() * (999999 - 100000)) + 100000; // random session id
  private _prevBytesRead: number = 0;

  private socket: any;
  public server: any;

  // ========== Typed Event Method Overloads ==========

  // on() overloads
  on<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  // once() overloads
  once<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  // off() overloads
  off<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  // addListener() overloads
  addListener<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.addListener(event, listener);
  }

  // removeListener() overloads
  removeListener<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener);
  }

  // prependListener() overloads
  prependListener<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependListener(event, listener);
  }

  // prependOnceListener() overloads
  prependOnceListener<K extends keyof SessionEventMap & string>(
    event: K,
    listener: SessionEventMap[K] extends void ? () => void : (value: SessionEventMap[K]) => void
  ): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependOnceListener(event, listener);
  }

  // emit() overloads
  emit<K extends keyof SessionEventMap & string>(
    event: K,
    ...args: SessionEventMap[K] extends void ? [] : [SessionEventMap[K]]
  ): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  rootSocket() {
    if (this.socket._parent) return this.socket._parent;
    return this.socket;
  }

  constructor(private options: SessionOptions = {}) {
    super();

    const self = this;
    let connectTimeout;
    this._extractPDUs = this._extractPDUs.bind(self);

    if (options.socket) {
      // server mode / socket is already connected.
      this._mode = 'server';
      this.socket = options.socket;
      this.remoteAddress = self.rootSocket().remoteAddress || self.remoteAddress;
      this.remotePort = this.rootSocket().remotePort;
      this.proxyProtocolProxy = this.rootSocket().proxyAddress
        ? { address: this.rootSocket().proxyAddress, port: this.rootSocket().proxyPort }
        : false;
    } else {
      // client mode
      this._mode = 'client';
      if (options.hasOwnProperty('connectTimeout') && options.connectTimeout > 0) {
        connectTimeout = setTimeout(function () {
          if (self.socket) {
            const e = new Error(
              'Timeout of ' +
                options.connectTimeout +
                'ms while connecting to ' +
                self.options.host +
                ':' +
                self.options.port
            );
            e['code'] = 'ETIMEOUT';
            e['timeout'] = options.connectTimeout;
            self.socket.destroy(e);
          }
        }, options.connectTimeout);
      }

      if (options.tls) {
        this.socket = tls.connect(this.options as tls.ConnectionOptions);
      } else {
        this.socket = net.connect(this.options as net.NetConnectOpts);
      }

      this.socket.on(
        'connect',
        function () {
          clearTimeout(connectTimeout);
          self.remoteAddress = self.rootSocket().remoteAddress || self.remoteAddress;
          self.remotePort = self.rootSocket().remotePort || self.remoteAddress;
          self.debug('server.connected', 'connected to server', { secure: options.tls });
          self.emitMetric('server.connected', 1);
          self.emit('connect'); // @todo should emit the session, but it would break BC
          if (self.options.auto_enquire_link_period) {
            self._interval = setInterval(function () {
              self.enquire_link();
            }, self.options.auto_enquire_link_period);
          }
        }.bind(this)
      );
      this.socket.on(
        'secureConnect',
        function () {
          self.emit('secureConnect'); // @todo should emit the session, but it would break BC
        }.bind(this)
      );
    }
    this.socket.on('readable', function () {
      const bytesRead = self.socket.bytesRead - self._prevBytesRead;
      if (bytesRead > 0) {
        // on disconnections the readable event receives 0 bytes, we do not want to debug that
        self.debug('socket.data.in', null, { bytes: bytesRead });
        self.emitMetric('socket.data.in', bytesRead, { bytes: bytesRead });
        self._prevBytesRead = self.socket.bytesRead;
      }
      self._extractPDUs();
    });
    this.socket.on('close', function () {
      self.closed = true;
      clearTimeout(connectTimeout);
      if (self._mode === 'server') {
        self.debug('client.disconnected', 'client has disconnected');
        self.emitMetric('client.disconnected', 1);
      } else {
        self.debug('server.disconnected', 'disconnected from server');
        self.emitMetric('server.disconnected', 1);
      }
      self.emit('close');
      if (self._interval) {
        clearInterval(self._interval);
        self._interval = 0;
      }
    });
    this.socket.on('error', function (e) {
      clearTimeout(connectTimeout);
      if (self._interval) {
        clearInterval(self._interval);
        self._interval = 0;
      }
      self.debug('socket.error', e.message, e);
      self.emitMetric('socket.error', 1, { error: e });
      self.emit('error', e); // Emitted errors will kill the program if they're not captured.
    });
  }

  emitMetric(event, value, payload?) {
    this.emit('metrics', event || null, value || null, payload || {}, {
      mode: this._mode || null,
      remoteAddress: this.remoteAddress || null,
      remotePort: this.remotePort || null,
      remoteTls: this.options.tls || false,
      sessionId: this._id || null,
      session: this,
    });
  }

  debug(type, msg, payload?) {
    if (type === undefined) type = null;
    if (msg === undefined) msg = null;
    if (this.options.debug) {
      const coloredTypes = {
        reset: '\x1b[0m',
        dim: '\x1b[2m',
        'client.connected': '\x1b[1m\x1b[34m',
        'client.disconnected': '\x1b[1m\x1b[31m',
        'server.connected': '\x1b[1m\x1b[34m',
        'server.disconnected': '\x1b[1m\x1b[31m',
        'pdu.command.in': '\x1b[36m',
        'pdu.command.out': '\x1b[32m',
        'pdu.command.error': '\x1b[41m\x1b[30m',
        'socket.error': '\x1b[41m\x1b[30m',
        'socket.data.in': '\x1b[2m',
        'socket.data.out': '\x1b[2m',
        metrics: '\x1b[2m',
      };
      const now = new Date();
      let logBuffer =
        now.toISOString() +
        ' - ' +
        (this._mode === 'server' ? 'srv' : 'cli') +
        ' - ' +
        this._id +
        ' - ' +
        (coloredTypes.hasOwnProperty(type)
          ? coloredTypes[type] + type + coloredTypes.reset
          : type) +
        ' - ' +
        (msg !== null ? msg : '') +
        ' - ' +
        coloredTypes.dim +
        (payload !== undefined ? JSON.stringify(payload) : '') +
        coloredTypes.reset;
      if (this.remoteAddress) logBuffer += ' - [' + this.remoteAddress + ']';
      console.log(logBuffer);
    }
    if (this.options.debugListener instanceof Function) {
      this.options.debugListener(type, msg, payload);
    }
    this.emit('debug', type, msg, payload);
  }

  connect() {
    this.sequence = 0;
    this.paused = false;
    this._busy = false;
    this._callbacks = {};
    this.socket.connect(this.options);
  }

  private _extractPDUs() {
    if (this._busy) {
      return;
    }
    this._busy = true;
    let pdu;
    while (!this.paused) {
      try {
        if (!this._command_length) {
          this._command_length = PDU.commandLength(this.socket);
          if (!this._command_length) {
            break;
          }
        }
        if (!(pdu = PDU.fromStream(this.socket, this._command_length))) {
          break;
        }
        this.debug('pdu.command.in', pdu.command, pdu);
        this.emitMetric('pdu.command.in', 1, pdu);
      } catch (e) {
        this.debug('pdu.command.error', e.message, e);
        this.emitMetric('pdu.command.error', 1, { error: e });
        this.emit('error', e);
        return;
      }
      this._command_length = null;
      this.emit('pdu', pdu);
      this.emit(pdu.command, pdu);
      if (pdu.isResponse() && this._callbacks[pdu.sequence_number]) {
        this._callbacks[pdu.sequence_number](pdu);
        delete this._callbacks[pdu.sequence_number];
      }
    }
    this._busy = false;
  }

  send(
    pdu: PDU,
    responseCallback?: PDUResponseCallback,
    sendCallback?: PDUSendCallback,
    failureCallback?: PDUFailureCallback
  ): boolean {
    if (!this.socket.writable) {
      const errorObject = {
        error: 'Socket is not writable',
        errorType: 'socket_not_writable',
      };
      this.debug('socket.data.error', null, errorObject);
      this.emitMetric('socket.data.error', 1, errorObject);
      if (failureCallback) {
        pdu.command_status = defs.errors.ESME_RSUBMITFAIL;
        failureCallback(pdu);
      }
      return false;
    }
    if (!pdu.isResponse()) {
      // when server/session pair is used to proxy smpp
      // traffic, the sequence_number will be provided by
      // client otherwise we generate it automatically
      if (!pdu.sequence_number) {
        if (this.sequence == 0x7fffffff) {
          this.sequence = 0;
        }
        pdu.sequence_number = ++this.sequence;
      }
      if (responseCallback) {
        this._callbacks[pdu.sequence_number] = responseCallback;
      }
    } else if (responseCallback && !sendCallback) {
      sendCallback = responseCallback;
    }
    this.debug('pdu.command.out', pdu.command, pdu);
    this.emitMetric('pdu.command.out', 1, pdu);
    const buffer = pdu.toBuffer();
    this.socket.write(
      buffer,
      function (err) {
        if (err) {
          this.debug('socket.data.error', null, {
            error: 'Cannot write command ' + pdu.command + ' to socket',
            errorType: 'socket_write_error',
          });
          this.emitMetric('socket.data.error', 1, {
            error: err,
            errorType: 'socket_write_error',
            pdu: pdu,
          });
          if (!pdu.isResponse() && this._callbacks[pdu.sequence_number]) {
            delete this._callbacks[pdu.sequence_number];
          }
          if (failureCallback) {
            pdu.command_status = defs.errors.ESME_RSUBMITFAIL;
            failureCallback(pdu, err);
          }
        } else {
          this.debug('socket.data.out', null, { bytes: buffer.length, error: err });
          this.emitMetric('socket.data.out', buffer.length, { bytes: buffer.length });
          this.emit('send', pdu);
          if (sendCallback) {
            sendCallback(pdu);
          }
        }
      }.bind(this)
    );
    return true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this._extractPDUs();
  }

  close(callback?: () => void): void {
    if (callback) {
      if (this.closed) {
        callback();
      } else {
        this.socket.once('close', callback);
      }
    }
    this.socket.end();
  }

  destroy(callback?: () => void): void {
    if (callback) {
      if (this.closed) {
        callback();
      } else {
        this.socket.once('close', callback);
      }
    }
    this.socket.destroy();
  }
}

const createShortcut = function (command) {
  return function (options, responseCallback, sendCallback, failureCallback) {
    if (typeof options == 'function') {
      sendCallback = responseCallback;
      responseCallback = options;
      options = {};
    }
    const pdu = new PDU(command, options);
    return this.send(pdu, responseCallback, sendCallback, failureCallback);
  };
};

for (const command in defs.commands) {
  Session.prototype[command] = createShortcut(command);
}

/**
 * SMPP Server interface extending net.Server
 */
export interface Server extends net.Server {
  /** Connected sessions */
  sessions: Session[];
  /** Whether this is a proxied server */
  isProxiedServer: boolean;
  /** Whether TLS is enabled */
  tls: boolean;
  /** Server options */
  options: ServerOptions;
}

/**
 * SMPP Secure Server interface extending tls.Server
 */
export interface SecureServer extends tls.Server {
  /** Connected sessions */
  sessions: Session[];
  /** Whether this is a proxied server */
  isProxiedServer: boolean;
  /** Whether TLS is enabled */
  tls: boolean;
  /** Server options */
  options: ServerOptions;
}

// Internal server constructor function
function ServerConstructor(this: any, options: ServerOptions | SessionListener, listener?: SessionListener) {
  let self = this,
    transport;
  this.sessions = [];

  if (typeof options == 'function') {
    listener = options;
    options = {};
  } else {
    options = options || {};
  }

  this.isProxiedServer = (options as ServerOptions).isProxiedServer == true;

  if (listener) {
    this.on('session', listener);
  }

  this.tls = !!(options as ServerOptions).key && !!(options as ServerOptions).cert;
  (options as ServerOptions).tls = this.tls; // standardized option for the session on both client & server
  this.options = options;

  self.on('proxiedConnection', function (socket: any) {
    // The connection has successfully passed through the proxied server (event emitted by proxywrap)
    socket.proxiedConnection = true;
  });

  // Fetch the right transport based on the current options
  if (this.isProxiedServer) {
    transport = this.tls ? proxyTlsTransport : proxyTransport;
  } else {
    transport = this.tls ? tls : net;
  }
  transport.Server.call(this, options, function (socket: any) {
    const session = new Session({
      socket: socket,
      tls: self.options.tls,
      debug: self.options.debug,
      debugListener: self.options.debugListener || undefined,
    });
    session.server = self;
    if (socket.savedEmit) {
      // Restore the saved emit to fix the proxywrap bug (on nodejs <=8)
      socket.emit = socket.savedEmit;
      socket.savedEmit = null;
    }
    session.debug('client.connected', 'client has connected', {
      secure: self.options.tls,
      // Useful information for Proxy protocol debugging & testing
      proxiedServer: self.isProxiedServer,
      proxiedConnection:
        socket.proxiedConnection ||
        (socket._parent ? socket._parent.proxiedConnection : false) ||
        false,
      remoteAddress: session.remoteAddress,
      remotePort: session.remotePort,
      proxyProtocolProxy: session.proxyProtocolProxy,
    });
    self.sessions.push(session);
    socket.on('close', function () {
      self.sessions.splice(self.sessions.indexOf(session), 1);
    });
    self.emit('session', session);
    session.emitMetric('client.connected', 1);
  });

  if (this.isProxiedServer) {
    // The proxied wrapper clears all connection listeners and adds their own.
    // A new listener is added in order to catch socket error on the wrapper.
    self.on('connection', function (socket: any) {
      socket.on('error', function (e: Error) {
        self.emit('error', e);
      });
      if (self.options.autoPrependBuffer) {
        // Allows to automatically prepend a buffer on the client socket. This feature is intended only for
        // testing purposes and it's used to inject client simulated headers (Proxy protocol)
        socket.unshift(self.options.autoPrependBuffer);
      }
      // There's a bug in the proxywrap server which tampers the emit method in nodejs <= 8 and makes the
      // socket unable to emit the events. As a simple fix, save the emit method so it can be restored later.
      socket.savedEmit = socket.emit;
    });
  }
}

function SecureServerConstructor(this: any, options: ServerOptions | SessionListener, listener?: SessionListener) {
  ServerConstructor.call(this, options, listener);
}

function ProxyServerConstructor(this: any, options: ServerOptions | SessionListener, listener?: SessionListener) {
  if (typeof options !== 'function') {
    options.isProxiedServer = true;
  }
  ServerConstructor.call(this, options, listener);
}

function ProxySecureServerConstructor(this: any, options: ServerOptions | SessionListener, listener?: SessionListener) {
  if (typeof options !== 'function') {
    options.isProxiedServer = true;
  }
  ServerConstructor.call(this, options, listener);
}

// Standard servers without proxy protocol support
util.inherits(ServerConstructor, net.Server);
util.inherits(SecureServerConstructor, tls.Server);

// Servers with proxy protocol support
util.inherits(ProxyServerConstructor, proxyTransport.Server);
util.inherits(ProxySecureServerConstructor, proxyTlsTransport.Server);

/**
 * Create an SMPP server
 * @param options - Server options or session listener
 * @param listener - Session listener callback
 * @returns Server instance (Server, SecureServer, ProxyServer, or ProxySecureServer)
 */
export function createServer(options?: ServerOptions | SessionListener, listener?: SessionListener): Server | SecureServer {
  if (typeof options == 'function') {
    listener = options;
    options = {};
  } else {
    options = options || {};
  }

  if (options.key && options.cert) {
    if (options.enable_proxy_protocol_detection) {
      return new (ProxySecureServerConstructor as any)(options, listener);
    } else {
      return new (SecureServerConstructor as any)(options, listener);
    }
  } else {
    if (options.enable_proxy_protocol_detection) {
      return new (ProxyServerConstructor as any)(options, listener);
    } else {
      return new (ServerConstructor as any)(options, listener);
    }
  }
}

/**
 * Connect to an SMPP server
 * @param options - Connection options, URL string, or connect callback
 * @param listener - Optional connect callback
 * @returns Session instance
 */
export function connect(options?: ConnectOptions | string | SessionListener, listener?: SessionListener | number): Session {
  let clientOptions: ConnectOptions = {};

  if (arguments.length > 1 && typeof listener === 'number') {
    clientOptions = {
      host: options as string,
      port: listener,
    };
    listener = arguments[2];
  } else if (typeof options == 'string') {
    const parsed = parse(options);
    clientOptions = {
      host: parsed.slashes ? parsed.hostname || undefined : options,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      tls: parsed.protocol === 'ssmpp:',
    };
  } else if (typeof options == 'function') {
    listener = options;
  } else {
    clientOptions = options || {};
    if (clientOptions.url) {
      const parsed = parse(clientOptions.url);
      clientOptions.host = parsed.hostname || undefined;
      clientOptions.port = parsed.port ? parseInt(parsed.port, 10) : undefined;
      clientOptions.tls = parsed.protocol === 'ssmpp:';
    }
  }
  if (clientOptions.tls && !clientOptions.hasOwnProperty('rejectUnauthorized')) {
    clientOptions.rejectUnauthorized = false; // Allow self signed certificates by default
  }
  clientOptions.port = clientOptions.port || (clientOptions.tls ? 3550 : 2775);
  clientOptions.debug = clientOptions.debug || false;
  clientOptions.connectTimeout = clientOptions.connectTimeout || 30000;

  const session = new Session(clientOptions);
  if (typeof listener === 'function') {
    session.on(clientOptions.tls ? 'secureConnect' : 'connect', function () {
      (listener as SessionListener)(session);
    });
  }

  return session;
}

/**
 * Alias for connect()
 */
export const createSession = connect;

/**
 * Add a custom SMPP command
 * @param command - Command name
 * @param options - Command definition
 */
export function addCommand(command: string, options: any): void {
  options.command = command;
  defs.commands[command] = options;
  defs.commandsById[options.id] = options;
  (Session.prototype as any)[command] = createShortcut(command);
}

/**
 * Add a custom TLV tag
 * @param tag - TLV tag name
 * @param options - TLV definition
 */
export function addTLV(tag: string, options: any): void {
  options.tag = tag;
  defs.tlvs[tag] = options;
  defs.tlvsById[options.id] = options;
}

// Re-export PDU class
export { PDU } from './pdu';

// Re-export all definitions from defs module
export {
  errors,
  encodings,
  filters,
  gsmCoder,
  consts,
  commands,
  commandsById,
  types,
  tlvs,
  tlvsById,
} from './defs';

// ========== Backwards-compatible top-level error code exports ==========
// These allow using smpp.ESME_ROK instead of smpp.errors.ESME_ROK
export const ESME_ROK = defs.errors.ESME_ROK;
export const ESME_RINVMSGLEN = defs.errors.ESME_RINVMSGLEN;
export const ESME_RINVCMDLEN = defs.errors.ESME_RINVCMDLEN;
export const ESME_RINVCMDID = defs.errors.ESME_RINVCMDID;
export const ESME_RINVBNDSTS = defs.errors.ESME_RINVBNDSTS;
export const ESME_RALYBND = defs.errors.ESME_RALYBND;
export const ESME_RINVPRTFLG = defs.errors.ESME_RINVPRTFLG;
export const ESME_RINVREGDLVFLG = defs.errors.ESME_RINVREGDLVFLG;
export const ESME_RSYSERR = defs.errors.ESME_RSYSERR;
export const ESME_RINVSRCADR = defs.errors.ESME_RINVSRCADR;
export const ESME_RINVDSTADR = defs.errors.ESME_RINVDSTADR;
export const ESME_RINVMSGID = defs.errors.ESME_RINVMSGID;
export const ESME_RBINDFAIL = defs.errors.ESME_RBINDFAIL;
export const ESME_RINVPASWD = defs.errors.ESME_RINVPASWD;
export const ESME_RINVSYSID = defs.errors.ESME_RINVSYSID;
export const ESME_RCANCELFAIL = defs.errors.ESME_RCANCELFAIL;
export const ESME_RREPLACEFAIL = defs.errors.ESME_RREPLACEFAIL;
export const ESME_RMSGQFUL = defs.errors.ESME_RMSGQFUL;
export const ESME_RINVSERTYP = defs.errors.ESME_RINVSERTYP;
export const ESME_RINVNUMDESTS = defs.errors.ESME_RINVNUMDESTS;
export const ESME_RINVDLNAME = defs.errors.ESME_RINVDLNAME;
export const ESME_RINVDESTFLAG = defs.errors.ESME_RINVDESTFLAG;
export const ESME_RINVSUBREP = defs.errors.ESME_RINVSUBREP;
export const ESME_RINVESMCLASS = defs.errors.ESME_RINVESMCLASS;
export const ESME_RCNTSUBDL = defs.errors.ESME_RCNTSUBDL;
export const ESME_RSUBMITFAIL = defs.errors.ESME_RSUBMITFAIL;
export const ESME_RINVSRCTON = defs.errors.ESME_RINVSRCTON;
export const ESME_RINVSRCNPI = defs.errors.ESME_RINVSRCNPI;
export const ESME_RINVDSTTON = defs.errors.ESME_RINVDSTTON;
export const ESME_RINVDSTNPI = defs.errors.ESME_RINVDSTNPI;
export const ESME_RINVSYSTYP = defs.errors.ESME_RINVSYSTYP;
export const ESME_RINVREPFLAG = defs.errors.ESME_RINVREPFLAG;
export const ESME_RINVNUMMSGS = defs.errors.ESME_RINVNUMMSGS;
export const ESME_RTHROTTLED = defs.errors.ESME_RTHROTTLED;
export const ESME_RINVSCHED = defs.errors.ESME_RINVSCHED;
export const ESME_RINVEXPIRY = defs.errors.ESME_RINVEXPIRY;
export const ESME_RINVDFTMSGID = defs.errors.ESME_RINVDFTMSGID;
export const ESME_RX_T_APPN = defs.errors.ESME_RX_T_APPN;
export const ESME_RX_P_APPN = defs.errors.ESME_RX_P_APPN;
export const ESME_RX_R_APPN = defs.errors.ESME_RX_R_APPN;
export const ESME_RQUERYFAIL = defs.errors.ESME_RQUERYFAIL;
export const ESME_RINVTLVSTREAM = defs.errors.ESME_RINVTLVSTREAM;
export const ESME_RTLVNOTALLWD = defs.errors.ESME_RTLVNOTALLWD;
export const ESME_RINVTLVLEN = defs.errors.ESME_RINVTLVLEN;
export const ESME_RMISSINGTLV = defs.errors.ESME_RMISSINGTLV;
export const ESME_RINVTLVVAL = defs.errors.ESME_RINVTLVVAL;
export const ESME_RDELIVERYFAILURE = defs.errors.ESME_RDELIVERYFAILURE;
export const ESME_RUNKNOWNERR = defs.errors.ESME_RUNKNOWNERR;
export const ESME_RSERTYPUNAUTH = defs.errors.ESME_RSERTYPUNAUTH;
export const ESME_RPROHIBITED = defs.errors.ESME_RPROHIBITED;
export const ESME_RSERTYPUNAVAIL = defs.errors.ESME_RSERTYPUNAVAIL;
export const ESME_RSERTYPDENIED = defs.errors.ESME_RSERTYPDENIED;
export const ESME_RINVDCS = defs.errors.ESME_RINVDCS;
export const ESME_RINVSRCADDRSUBUNIT = defs.errors.ESME_RINVSRCADDRSUBUNIT;
export const ESME_RINVDSTADDRSUBUNIT = defs.errors.ESME_RINVDSTADDRSUBUNIT;
export const ESME_RINVBCASTFREQINT = defs.errors.ESME_RINVBCASTFREQINT;
export const ESME_RINVBCASTALIAS_NAME = defs.errors.ESME_RINVBCASTALIAS_NAME;
export const ESME_RINVBCASTAREAFMT = defs.errors.ESME_RINVBCASTAREAFMT;
export const ESME_RINVNUMBCAST_AREAS = defs.errors.ESME_RINVNUMBCAST_AREAS;
export const ESME_RINVBCASTCNTTYPE = defs.errors.ESME_RINVBCASTCNTTYPE;
export const ESME_RINVBCASTMSGCLASS = defs.errors.ESME_RINVBCASTMSGCLASS;
export const ESME_RBCASTFAIL = defs.errors.ESME_RBCASTFAIL;
export const ESME_RBCASTQUERYFAIL = defs.errors.ESME_RBCASTQUERYFAIL;
export const ESME_RBCASTCANCELFAIL = defs.errors.ESME_RBCASTCANCELFAIL;
export const ESME_RINVBCAST_REP = defs.errors.ESME_RINVBCAST_REP;
export const ESME_RINVBCASTSRVGRP = defs.errors.ESME_RINVBCASTSRVGRP;
export const ESME_RINVBCASTCHANIND = defs.errors.ESME_RINVBCASTCHANIND;

// ========== Backwards-compatible top-level constant exports ==========
// These allow using smpp.TON instead of smpp.consts.TON
export const REGISTERED_DELIVERY = defs.consts.REGISTERED_DELIVERY;
export const ESM_CLASS = defs.consts.ESM_CLASS;
export const MESSAGE_STATE = defs.consts.MESSAGE_STATE;
export const TON = defs.consts.TON;
export const NPI = defs.consts.NPI;
export const ENCODING = defs.consts.ENCODING;
export const NETWORK = defs.consts.NETWORK;
export const BROADCAST_AREA_FORMAT = defs.consts.BROADCAST_AREA_FORMAT;
export const BROADCAST_FREQUENCY_INTERVAL = defs.consts.BROADCAST_FREQUENCY_INTERVAL;

// Re-export PDU types
export * from './types';
