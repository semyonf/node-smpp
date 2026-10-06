var assert = require('assert'),
    crypto = require('crypto'),
    fs = require('fs'),
    smpp = require('..');

describe('Server', function() {
	var server;

	before(function() {
		server = smpp.createServer();
	});

	describe('#listen()', function() {
		beforeEach(function (done) {
			server.listen(6789, done);
		});

		afterEach(function (done) {
			server.once('close', done);
			server.close();
		});

		it('should bind to a custom port', function() {
			assert.ok(server.address().port === 6789, 'Invalid custom port');
		});

	});

	describe('#listenRandomPort()', function() {
		beforeEach(function (done) {
			server.listen(0, done);
		});

		afterEach(function (done) {
			server.once('close', done);
			server.close();
		});

		var port;

		it('should bind to a random port', function() {
			port = server.address().port;
			assert.ok(port > 0, 'Invalid first random port');
		});

		it('should bind to another random port', function() {
			var newPort = server.address().port;
			assert.ok(newPort > 0, 'Invalid second random port');
			assert.notEqual(newPort, port, 'Both random ports are equal!');
		});
	});

});

describe('Session', function() {
	var server, port, secure = {}, autoresponder = {};

	var sessionHandler = function(session) {
		session.on('enquire_link', function(pdu) {
			session.send(pdu.response());
		});
		session.on('submit_sm', function(pdu) {
			var response = pdu.response();
			response.message_id = "123456789 sent to " + pdu.destination_addr; // Injected to verify the data received by the server
			session.send(response);
		});
	};

	var sessionHandlerAutoresponder = function(session) {
		session.on('pdu', function(pdu) {
			session.send(pdu.response()); // Always reply
		});
	};

	beforeEach(function(done) {
		server = smpp.createServer({}, sessionHandler);
		server.listen(0, done);
		port = server.address().port;
	});

	beforeEach(function(done) {
		autoresponder.server = smpp.createServer({}, sessionHandlerAutoresponder);
		autoresponder.server.listen(0, done);
		autoresponder.port = autoresponder.server.address().port;
	});

	beforeEach(function(done) {
		secure.server = smpp.createServer({
			key: fs.readFileSync(__dirname + '/fixtures/server.key'),
			cert: fs.readFileSync(__dirname + '/fixtures/server.crt')
		}, sessionHandler);
		secure.server.listen(0, done);
		secure.port = secure.server.address().port;
	});

	afterEach(function(done) {
		server.sessions.forEach(function(session) {
			session.close();
		});
		server.close(done);
	});

	afterEach(function(done) {
		autoresponder.server.sessions.forEach(function(session) {
			session.close();
		});
		autoresponder.server.close(done);
	});

	afterEach(function(done) {
		secure.server.sessions.forEach(function(session) {
			session.close();
		});
		secure.server.close(done);
	});

	describe('smpp.connect()', function() {
		it('should use 2775 or 3550 as default port', function() {
			var session = smpp.connect();
			session.on('error', function() {});
			assert.equal(session.options.port, 2775);

			session = smpp.connect({tls: true});
			session.on('error', function() {});
			assert.equal(session.options.port, 3550);

			session = smpp.connect('smpp://localhost');
			session.on('error', function() {});
			assert.equal(session.options.port, 2775);

			session = smpp.connect('ssmpp://localhost');
			session.on('error', function() {});
			assert.equal(session.options.port, 3550);
		});

		it('should be backward compatible', function() {
			var session = smpp.connect('127.0.0.1');
			session.on('error', function() {});
			assert.equal(session.options.port, 2775);
			assert.equal(session.options.host, '127.0.0.1');

			session = smpp.connect('127.0.0.1', 1234);
			session.on('error', function() {});
			assert.equal(session.options.port, 1234);
			assert.equal(session.options.host, '127.0.0.1');
		});

		it('should properly parse connection url', function() {
			var session = smpp.connect('smpp://127.0.0.1:1234');
			session.on('error', function() {});
			assert.equal(session.options.port, 1234);
			assert.equal(session.options.host, '127.0.0.1');

			session = smpp.connect('ssmpp://localhost');
			session.on('error', function() {});
			assert(session.options.tls);

			session = smpp.connect({ url: 'ssmpp://127.0.0.1:1234'});
			session.on('error', function() {});
			assert(session.options.tls);
			assert.equal(session.options.port, 1234);
			assert.equal(session.options.host, '127.0.0.1');
		});

		it('should successfully establish a connection', function(done) {
			smpp.connect({ port: port }, function() {
				done();
			});
		});

		it('should successfully establish a secure connection', function(done) {
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function() {
				// The server may not have registered its side of the session yet, so the
				// afterEach hook cannot close it for us — leaving the socket open would
				// stall secure.server.close().
				session.close();
				done();
			});
		});

		it('should successfully connect by instantiating a Session directly, skipping the smpp.connect() factory', function(done) {
			// There are some clients using this approach.
			// This should be deprecated in the future to make sure every client connection goes through the factory method.
			var session = new smpp.Session({
				host: "127.0.0.1",
				port: port
			});
			session.on("connect", done);
		});
	});

	describe('#send()', function() {
		it('should successfully send a pdu', function(done) {
			var session = smpp.connect({ port: port }, function() {
				var pdu = new smpp.PDU('enquire_link');
				session.send(pdu, done.bind(this, null));
			});
		});

		it('should successfully send a pdu using shorthand methods', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period:10000 }, function() {
				session.enquire_link(done.bind(this, null));
			});
		});

		it('should successfully send a pdu on a secure connection', function(done) {
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function() {
				session.enquire_link(done.bind(this, null));
			});
		});

		it('should successfully send a pdu and receive its response', function(done) {
			var session = smpp.connect({ port: port }, function() {
				session.submit_sm({
					destination_addr: "+01123456789",
					short_message: "Hello!"
				}, function(pdu) {
					assert.equal(pdu.command, "submit_sm_resp");
					assert.equal(pdu.command_status, smpp.ESME_ROK);
					assert.equal(pdu.message_id, "123456789 sent to +01123456789");
					done();
				});
			});
		});

		it('should successfully receive matching responses for any pdu sent with a generic autoreply server handler', function(done) {
			var session = smpp.connect({ port: autoresponder.port}, function() {
				session.bind_transceiver({}, function(pdu) {
					assert.equal(pdu.command, "bind_transceiver_resp");
					session.bind_receiver({}, function(pdu) {
						assert.equal(pdu.command, "bind_receiver_resp");
						session.bind_transmitter({}, function(pdu) {
							assert.equal(pdu.command, "bind_transmitter_resp");
							done();
						});
					});
				});
			});
		});

		it('should receive failure callback', function(done) {
			var session = smpp.connect({ port: autoresponder.port}, function() {
				session.bind_transceiver({}, function(pdu) {
					session.socket.writable = false;
					session.submit_sm(new smpp.PDU('submit_sm'), function(pdu) {
						throw Error('There should not be response');
					},
					function(pdu) {
						throw Error('There should not be request call');
					},
					function(pdu) {
						assert.equal(pdu.command, 'submit_sm');
						assert.equal(pdu.command_status, smpp.ESME_RSUBMITFAIL);
						done();
					});
				});
			});
		});
	});

	describe('#tls', function() {
		it('should be false on an incoming session of a plain server', function(done) {
			var client;
			server.once('session', function(session) {
				assert.strictEqual(session.tls, false);
				client.close();
				done();
			});
			client = smpp.connect({ port: port });
			client.on('error', done);
		});

		it('should be true on an incoming session of a secure server', function(done) {
			var client;
			secure.server.once('session', function(session) {
				assert.strictEqual(session.tls, true);
				client.close();
				done();
			});
			client = smpp.connect({ port: secure.port, tls: true, rejectUnauthorized: false });
			client.on('error', done);
		});

		it('should be true on a client session connected through an ssmpp url', function(done) {
			var session = smpp.connect('ssmpp://localhost:' + secure.port, function() {
				assert.strictEqual(session.tls, true);
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should be false on a client session connected through an smpp url', function(done) {
			var session = smpp.connect('smpp://localhost:' + port, function() {
				assert.strictEqual(session.tls, false);
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should be true on a client session connected with the tls option', function(done) {
			var session = smpp.connect({
				host: 'localhost',
				port: secure.port,
				tls: true
			}, function() {
				assert.strictEqual(session.tls, true);
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should be false on a session instantiated directly without the tls option', function(done) {
			var session = new smpp.Session({ host: 'localhost', port: port });
			session.on('error', done);
			session.on('connect', function() {
				assert.strictEqual(session.tls, false);
				session.close();
				done();
			});
		});
	});

	describe('#getPeerCertificate()', function() {
		var fixtureNotAfter = new crypto.X509Certificate(
			fs.readFileSync(__dirname + '/fixtures/server.crt')
		).validTo;

		it('should return the certificate presented by the server on a secure client session', function(done) {
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function() {
				var cert = session.getPeerCertificate();
				assert.ok(cert, 'No certificate returned');
				assert.strictEqual(cert.valid_to, fixtureNotAfter);
				assert.strictEqual(cert.issuerCertificate, undefined, 'Should not be detailed by default');
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should return undefined on a plain client session', function(done) {
			var session = smpp.connect({ port: port }, function() {
				assert.strictEqual(session.getPeerCertificate(), undefined);
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should return an empty object, not undefined, on a secure server session which did not request a client certificate', function(done) {
			var client;
			secure.server.once('session', function(session) {
				// An empty object means "TLS is up, but the peer sent no certificate", which is a
				// different situation than "this session is not TLS at all" (undefined).
				assert.notStrictEqual(session.getPeerCertificate(), undefined);
				assert.deepStrictEqual(session.getPeerCertificate(), {});
				client.close();
				done();
			});
			client = smpp.connect({ port: secure.port, tls: true, rejectUnauthorized: false });
			client.on('error', done);
		});

		it('should return a detailed certificate when asked for one', function(done) {
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function() {
				var cert = session.getPeerCertificate(true);
				assert.ok(cert.issuerCertificate, 'issuerCertificate is missing from the detailed certificate');
				session.close();
				done();
			});
			session.on('error', done);
		});

		it('should not throw when called before the handshake has completed', function(done) {
			var session = smpp.connect({ port: secure.port, tls: true, rejectUnauthorized: false });
			assert.doesNotThrow(function() {
				session.getPeerCertificate();
			});
			session.on('error', done);
			session.on('secureConnect', function() {
				session.close();
				done();
			});
		});

		it('should not throw when called after the session has been closed', function(done) {
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function() {
				session.close(function() {
					assert.doesNotThrow(function() {
						session.getPeerCertificate();
					});
					done();
				});
			});
			session.on('error', done);
		});
	});

});

describe('Session response_timeout', function() {
	// The server never answers on its own: each test decides if and when it does.
	var server, port, received, clients;

	beforeEach(function(done) {
		received = [];
		clients = [];
		server = smpp.createServer({}, function(session) {
			session.on('error', function() {});
			session.on('pdu', function(pdu) {
				received.push({ session: session, pdu: pdu });
			});
		});
		server.listen(0, done);
		port = server.address().port;
	});

	afterEach(function(done) {
		clients.forEach(function(session) {
			session.destroy();
		});
		server.sessions.forEach(function(session) {
			session.destroy();
		});
		server.close(done);
	});

	function connect(options, callback) {
		options.port = port;
		var session = smpp.connect(options, function() {
			callback(session);
		});
		clients.push(session);
		return session;
	}

	function closeFromServerOnceReceived(count) {
		if (received.length < count) {
			setTimeout(closeFromServerOnceReceived, 1, count);
			return;
		}
		received[0].session.destroy();
	}

	function submitSm() {
		return new smpp.PDU('submit_sm', {
			destination_addr: '+01123456789',
			short_message: 'Hello!'
		});
	}

	function unexpected(done, what) {
		return function() {
			done(new Error('Unexpected ' + what));
		};
	}

	it('should fail a request with ERESPONSETIMEOUT and the request pdu when no response arrives in time', function(done) {
		connect({ response_timeout: 20 }, function(session) {
			var pdu = submitSm(), events = [];
			session.on('response_timeout', function(timedOut) {
				events.push(timedOut);
			});
			session.send(pdu, unexpected(done, 'response'), null, function(failed, err) {
				assert.strictEqual(failed, pdu);
				assert.equal(failed.command, 'submit_sm');
				assert.ok(failed.sequence_number > 0);
				// No status was received from the peer, so none is made up.
				assert.strictEqual(failed.command_status, 0);
				assert.ok(err instanceof Error);
				assert.equal(err.code, 'ERESPONSETIMEOUT');
				assert.equal(err.timeout, 20);
				assert.deepStrictEqual(events, [pdu]);
				assert.deepStrictEqual(session._callbacks, {});
				done();
			});
		});
	});

	it('should emit response_timeout for a request sent without a failureCallback', function(done) {
		connect({ response_timeout: 20 }, function(session) {
			session.submit_sm({ destination_addr: '+01123456789' }, unexpected(done, 'response'));
			session.on('response_timeout', function(pdu) {
				assert.equal(pdu.command, 'submit_sm');
				assert.deepStrictEqual(session._callbacks, {});
				done();
			});
		});
	});

	it('should not time out requests by default, nor with a response_timeout of 0', function(done) {
		var connected = 0;
		[{}, { response_timeout: 0 }].forEach(function(options) {
			connect(options, function(session) {
				var pdu = submitSm();
				session.on('response_timeout', unexpected(done, 'response_timeout event'));
				session.send(pdu, unexpected(done, 'response'), null, unexpected(done, 'failure'));
				assert.strictEqual(session._callbacks[pdu.sequence_number].timer, null);
				if (++connected === 2) {
					setTimeout(function() {
						clients.forEach(function(client) {
							assert.equal(Object.keys(client._callbacks).length, 1);
						});
						done();
					}, 30);
				}
			});
		});
	});

	it('should reject invalid response_timeout values', function() {
		[-1, NaN, Infinity, '1000', true, 0x80000000].forEach(function(value) {
			assert.throws(function() {
				smpp.connect({ port: port, response_timeout: value });
			}, RangeError, 'connect() accepted ' + value);
			assert.throws(function() {
				smpp.createServer({ response_timeout: value });
			}, RangeError, 'createServer() accepted ' + value);
		});
		[undefined, null, 0, 1, 0x7fffffff].forEach(function(value) {
			smpp.createServer({ response_timeout: value });
		});
	});

	it('should clear the timer when the response arrives in time', function(done) {
		server.once('session', function(serverSession) {
			serverSession.on('submit_sm', function(pdu) {
				serverSession.send(pdu.response());
			});
		});
		connect({ response_timeout: 30 }, function(session) {
			var pdu = submitSm(), entry;
			session.on('response_timeout', unexpected(done, 'response_timeout event'));
			session.send(pdu, function(response) {
				assert.equal(response.command, 'submit_sm_resp');
				assert.strictEqual(entry.timer, null);
				assert.deepStrictEqual(session._callbacks, {});
				// Outlive the timeout, in case the timer was not cleared after all.
				setTimeout(done, 50);
			}, null, unexpected(done, 'failure'));
			entry = session._callbacks[pdu.sequence_number];
			assert.ok(entry.timer);
		});
	});

	it('should not call any callback for a response arriving after the timeout, but still emit it', function(done) {
		var held = null, timedOut = false, failures = 0;
		// The server answers only once the client has timed out, whatever the scheduling.
		function respondLate() {
			if (held && timedOut) held.session.send(held.pdu.response());
		}
		server.once('session', function(serverSession) {
			serverSession.on('submit_sm', function(pdu) {
				held = { session: serverSession, pdu: pdu };
				respondLate();
			});
		});
		connect({ response_timeout: 20 }, function(session) {
			var pduEvents = 0;
			session.on('pdu', function() {
				pduEvents++;
			});
			session.on('submit_sm_resp', function(response) {
				assert.equal(response.sequence_number, held.pdu.sequence_number);
				assert.equal(pduEvents, 1);
				setImmediate(function() {
					assert.equal(failures, 1);
					done();
				});
			});
			session.send(submitSm(), unexpected(done, 'response callback'), null, function(pdu, err) {
				failures++;
				assert.equal(err.code, 'ERESPONSETIMEOUT');
				timedOut = true;
				respondLate();
			});
		});
	});

	it('should fail every pending request exactly once, with its own pdu, when the session closes', function(done) {
		connect({ response_timeout: 1000 }, function(session) {
			var sent = [submitSm(), submitSm(), new smpp.PDU('query_sm')], failures = [], aborted = [];
			session.on('response_aborted', function(pdu) {
				aborted.push(pdu);
			});
			sent.forEach(function(pdu) {
				session.send(pdu, unexpected(done, 'response'), null, function(failed, err) {
					failures.push({ pdu: failed, err: err });
				});
			});
			var entries = sent.map(function(pdu) {
				return session._callbacks[pdu.sequence_number];
			});
			session.on('close', function() {
				// Settled before 'close' is emitted.
				assert.deepStrictEqual(failures.map(function(f) { return f.pdu; }), sent);
				failures.forEach(function(f) {
					assert.equal(f.err.code, 'ESESSIONCLOSED');
					assert.strictEqual(f.err.cause, undefined);
					assert.strictEqual(f.pdu.command_status, 0);
				});
				assert.deepStrictEqual(aborted, sent);
				assert.deepStrictEqual(session._callbacks, {});
				entries.forEach(function(entry) {
					assert.strictEqual(entry.timer, null);
				});
				setImmediate(function() {
					assert.equal(failures.length, 3);
					done();
				});
			});
			closeFromServerOnceReceived(3);
		});
	});

	it('should fail a pending request once when a socket error is followed by close, with the error as cause', function(done) {
		connect({ response_timeout: 1000 }, function(session) {
			var boom = new Error('boom'), failures = [];
			session.on('error', function(e) {
				assert.strictEqual(e, boom);
				assert.equal(failures.length, 0, 'failed on error rather than on close');
			});
			session.on('close', function() {
				setTimeout(function() {
					assert.equal(failures.length, 1);
					assert.equal(failures[0].code, 'ESESSIONCLOSED');
					assert.strictEqual(failures[0].cause, boom);
					done();
				}, 10);
			});
			session.send(submitSm(), unexpected(done, 'response'), function() {
				session.socket.destroy(boom);
			}, function(pdu, err) {
				failures.push(err);
			});
		});
	});

	it('should report a request exactly once when the socket is destroyed while writing it', function(done) {
		connect({ response_timeout: 1000 }, function(session) {
			var failures = [];
			session.on('error', function() {});
			session.on('close', function() {
				// Leave room for a write callback that runs after 'close'.
				setTimeout(function() {
					assert.equal(failures.length, 1);
					done();
				}, 20);
			});
			session.send(submitSm(), unexpected(done, 'response'), null, function(pdu, err) {
				failures.push(err);
			});
			session.socket.destroy(new Error('boom'));
		});
	});

	it('should not report a write failure for a request that already timed out', function(done) {
		connect({ response_timeout: 10 }, function(session) {
			var failures = [], writeCallback;
			// Hold the write so that it fails only after the timeout.
			session.socket.write = function(buffer, callback) {
				writeCallback = callback;
				return true;
			};
			session.send(submitSm(), unexpected(done, 'response'), unexpected(done, 'send'), function(pdu, err) {
				failures.push(err.code);
				if (failures.length > 1) return;
				writeCallback(new Error('EPIPE'));
				setImmediate(function() {
					assert.deepStrictEqual(failures, ['ERESPONSETIMEOUT']);
					done();
				});
			});
		});
	});

	it('should report a write failure the way it always did, and not time the request out afterwards', function(done) {
		connect({ response_timeout: 10 }, function(session) {
			var failures = [], writeError = new Error('EPIPE');
			session.on('response_timeout', unexpected(done, 'response_timeout event'));
			session.socket.write = function(buffer, callback) {
				setImmediate(callback, writeError);
				return true;
			};
			session.send(submitSm(), unexpected(done, 'response'), unexpected(done, 'send'), function(pdu, err) {
				failures.push(err);
				assert.equal(pdu.command_status, smpp.ESME_RSUBMITFAIL);
				assert.deepStrictEqual(session._callbacks, {});
				// Outlive the timeout, in case the timer was not cleared.
				setTimeout(function() {
					assert.deepStrictEqual(failures, [writeError]);
					done();
				}, 30);
			});
		});
	});

	it('should leave pending requests alone on close without response_timeout', function(done) {
		connect({}, function(session) {
			var pdu = submitSm();
			session.on('response_aborted', unexpected(done, 'response_aborted event'));
			session.send(pdu, unexpected(done, 'response'), null, unexpected(done, 'failure'));
			session.on('close', function() {
				setImmediate(function() {
					assert.ok(session._callbacks[pdu.sequence_number]);
					done();
				});
			});
			closeFromServerOnceReceived(1);
		});
	});

	it('should apply the server response_timeout option to the sessions it accepts', function(done) {
		var client;
		var timingOutServer = smpp.createServer({ response_timeout: 20 }, function(session) {
			session.on('error', function() {});
			session.deliver_sm({ source_addr: '+01123456789' }, unexpected(done, 'response'), null, function(pdu, err) {
				assert.equal(pdu.command, 'deliver_sm');
				assert.equal(err.code, 'ERESPONSETIMEOUT');
				assert.equal(err.timeout, 20);
				client.destroy();
				timingOutServer.close(function() {
					done();
				});
			});
		});
		timingOutServer.listen(0, function() {
			// The client never answers the deliver_sm.
			client = smpp.connect({ port: timingOutServer.address().port });
			client.on('error', function() {});
		});
	});

	it('should not let the timer of a request time out a newer request reusing its sequence_number', function(done) {
		connect({ response_timeout: 20 }, function(session) {
			// As when proxying, where sequence numbers are provided by the caller.
			var first = new smpp.PDU('submit_sm', { sequence_number: 42 });
			var second = new smpp.PDU('submit_sm', { sequence_number: 42 });
			session.send(first, unexpected(done, 'response to the first request'), null,
				unexpected(done, 'failure of the displaced request'));
			var firstEntry = session._callbacks[42];
			session.send(second, unexpected(done, 'response to the second request'), null, function(pdu, err) {
				assert.strictEqual(pdu, second);
				assert.equal(err.code, 'ERESPONSETIMEOUT');
				setImmediate(done);
			});
			assert.notStrictEqual(session._callbacks[42], firstEntry);
			assert.strictEqual(firstEntry.timer, null);
		});
	});
});

describe('Client/Server simulations', function() {

	describe('standard connection simulations', function() {
		var server, port, secure = {}, debugBuffer = [], lastServerError;

		beforeEach(function (done) {
			var sessionHandler = function (session) {
				debugBuffer = [];
				// We'll use the debug event to track what happened inside the server
				session.on('debug', function(type, msg, payload) {
					debugBuffer.push({type: type, msg: msg, payload: payload});
				});
				session.on('submit_sm', function (pdu) {
					var response = pdu.response();
					response.message_id = "123456789 sent to " + pdu.destination_addr; // Injected to verify the data received by the server
					session.send(response);
				});
				session.on('bind_transceiver', function (pdu) {
					// pause the session to prevent further incoming pdu events,
					// untill we authorize the session with some async operation.
					session.pause();
					var checkAsyncUserPass = function (user, pwd, onComplete) {
						setTimeout(function () {
							if (user === "FAKE_USER" && pwd === "FAKE_PASSWORD") {
								onComplete();
							} else {
								onComplete("invalid user and password combination");
							}
						}, 25); // Delayed processing simulation
					};
					checkAsyncUserPass(pdu.system_id, pdu.password, function (err) {
						if (err) {
							session.send(pdu.response({ command_status: smpp.ESME_RBINDFAIL}));
							session.close();
						} else {
							session.send(pdu.response());
							session.resume();
						}
					});
				});
				// Errors
				session.on('error', function (err) {
					lastServerError = err;
					session.close();
				});
			}
			server = smpp.createServer({}, sessionHandler);
			server.listen(0);
			port = server.address().port;

			secure.server = smpp.createServer({
				key: fs.readFileSync(__dirname + '/fixtures/server.key'),
				cert: fs.readFileSync(__dirname + '/fixtures/server.crt')
			}, sessionHandler);
			secure.server.listen(0, done);
			secure.port = secure.server.address().port;
		});

		afterEach(function (done) {
			server.sessions.forEach(function (session) {
				session.close();
			});
			server.close();

			secure.server.sessions.forEach(function (session) {
				session.close();
			});
			secure.server.close(done);
		});

		it('should successfully bind a transceiver with a hardcoded user/password', function (done) {
			var session = smpp.connect({port: port}, function () {
				session.bind_transceiver({
					system_id: 'FAKE_USER',
					password: 'FAKE_PASSWORD'
				}, function (pdu) {
					assert.equal(pdu.command, "bind_transceiver_resp");
					assert.equal(pdu.command_status, smpp.ESME_ROK);
					// send fake message
					session.submit_sm({
						destination_addr: "+01123456789",
						short_message: "Hello!"
					}, function (pdu) {
						assert.equal(pdu.command, "submit_sm_resp");
						assert.equal(pdu.command_status, smpp.ESME_ROK);
						assert.equal(pdu.message_id, "123456789 sent to +01123456789");
						done();
					});
				});
			});
		});

		it('should fail to bind a transceiver with a wrong hardcoded user/password', function (done) {
			var session = smpp.connect({port: port}, function () {
				session.bind_transceiver({
					system_id: 'FAKE_USER_INVALID',
					password: 'FAKE_PASSWORD_INVALID'
				}, function (pdu) {
					assert.equal(pdu.command, "bind_transceiver_resp");
					assert.equal(pdu.command_status, smpp.ESME_RBINDFAIL);
					done();
				});
			});
		});

		it('should successfully emit every expected debug log entry', function (done) {
			var session = smpp.connect({port: port}, function () {
				session.bind_transceiver({
					system_id: 'FAKE_USER',
					password: 'FAKE_PASSWORD'
				}, function (pdu) {
					assert.equal(pdu.command, "bind_transceiver_resp");
					assert.equal(pdu.command_status, smpp.ESME_ROK);

					// Read the server debug entries to find the relevant types that should have been emitted.
					var debugEntry, i;

					assert.notEqual(debugBuffer.length, 0, "Debug log is empty");

					for (i = 0, debugEntry = null; i < debugBuffer.length && debugEntry === null; i++) if (debugBuffer[i].type === "pdu.command.in") debugEntry = debugBuffer[i];
					assert.notEqual(debugEntry, null, "pdu.command.in entry not found in debug log");
					assert.equal(debugEntry ? debugEntry.msg : null, "bind_transceiver", "bind_transceiver command not found in log");

					for (i = 0, debugEntry = null; i < debugBuffer.length && debugEntry === null; i++) if (debugBuffer[i].type === "pdu.command.out") debugEntry = debugBuffer[i];
					assert.notEqual(debugEntry, null, "pdu.command.out entry not found in debug log");
					assert.equal(debugEntry ? debugEntry.msg : null, "bind_transceiver_resp", "bind_transceiver_resp command not found in log");

					done();
				});
			});
		});

		it('should fail to connect with an invalid port and trigger a ECONNREFUSED error', function (done) {
			var session = smpp.connect({port: 27750}, function () {});
			session.on('error', function (e) {
				// empty callback to catch emitted errors to prevent exit due unhandled errors
				assert.equal(e.code, "ECONNREFUSED");
				done();
			});
		});

		it('should fail to connect with an invalid host and trigger a EAI_AGAIN, ENOTFOUND or ESRCH error', function (done) {
			this.timeout(5000); // on Windows timeout is greater than 2000ms
			var session = smpp.connect({url: 'smpp://unknownhost:2775'});
			session.on('error', function (e) {
				// empty callback to catch emitted errors to prevent exit due unhandled errors
				assert.notEqual(-1, ["EAI_AGAIN", "ENOTFOUND", "ESRCH"].indexOf(e.code));
				done();
			});
		});

		it('should fail to connect with an invalid host and trigger a ETIMEOUT error', function (done) {
			var session = smpp.connect({url: 'smpp://1.1.1.1:2775', connectTimeout: 25});
			session.on('error', function (e) {
				// empty callback to catch emitted errors to prevent exit due unhandled errors
				assert.equal(e.code, "ETIMEOUT");
				done();
			});
		});

		it('should successfully emit every expected metric', function (done) {
			var clientMetricsEmitted = [], serverMetricsEmitted = [], metricsEntry = null;
			var session = smpp.connect({
				port: secure.port,
				tls: true,
				rejectUnauthorized: false
			}, function () {
				session.bind_transceiver({
					system_id: 'FAKE_USER',
					password: 'FAKE_PASSWORD'
				}, function (pdu) {
					session.close(function() {
						// Check client metrics
						for (i = 0, metricsEntry = null; i < clientMetricsEmitted.length && metricsEntry === null; i++) if (clientMetricsEmitted[i].event === "server.connected") metricsEntry = clientMetricsEmitted[i];
						assert.notEqual(metricsEntry.event, null, "server.connected entry not found in metrics");
						for (i = 0, metricsEntry = null; i < clientMetricsEmitted.length && metricsEntry === null; i++) if (clientMetricsEmitted[i].event === "pdu.command.out") metricsEntry = clientMetricsEmitted[i];
						assert.notEqual(metricsEntry.event, null, "pdu.command.out entry not found in metrics");
						for (i = 0, metricsEntry = null; i < clientMetricsEmitted.length && metricsEntry === null; i++) if (clientMetricsEmitted[i].event === "pdu.command.in") metricsEntry = clientMetricsEmitted[i];
						assert.notEqual(metricsEntry.event, null, "pdu.command.in entry not found in metrics");
						for (i = 0, metricsEntry = null; i < clientMetricsEmitted.length && metricsEntry === null; i++) if (clientMetricsEmitted[i].event === "server.disconnected") metricsEntry = clientMetricsEmitted[i];
						assert.notEqual(metricsEntry.event, null, "server.disconnected entry not found in metrics");
					})
				});
			});
			// Add metrics loggers
			session.on("metrics", function(event, value, payload, context) {
				clientMetricsEmitted.push({event: event, value: value, payload: payload});
			});
			secure.server.on("session", function(serverSession) {
				serverSession.on("metrics", function(event, value, payload, context) {
					serverMetricsEmitted.push({event: event, value: value, payload: payload});
				})
				serverSession.on("close", function() {
					// Check server metrics
					for (i = 0, metricsEntry = null; i < serverMetricsEmitted.length && metricsEntry === null; i++) if (serverMetricsEmitted[i].event === "client.connected") metricsEntry = serverMetricsEmitted[i];
					assert.notEqual(metricsEntry.event, null, "client.connected entry not found in metrics");
					for (i = 0, metricsEntry = null; i < serverMetricsEmitted.length && metricsEntry === null; i++) if (serverMetricsEmitted[i].event === "pdu.command.out") metricsEntry = serverMetricsEmitted[i];
					assert.notEqual(metricsEntry.event, null, "pdu.command.out entry not found in metrics");
					for (i = 0, metricsEntry = null; i < serverMetricsEmitted.length && metricsEntry === null; i++) if (serverMetricsEmitted[i].event === "pdu.command.in") metricsEntry = serverMetricsEmitted[i];
					assert.notEqual(metricsEntry.event, null, "pdu.command.in entry not found in metrics");
					for (i = 0, metricsEntry = null; i < serverMetricsEmitted.length && metricsEntry === null; i++) if (serverMetricsEmitted[i].event === "client.disconnected") metricsEntry = serverMetricsEmitted[i];
					assert.notEqual(metricsEntry.event, null, "client.disconnected entry not found in metrics");
					done();
				})
			});
		});
	});


	describe('heavy load simulations', function() {

		var server, port, lastServerError;

		beforeEach(function (done) {
			server = smpp.createServer({}, function (session) {
				session.on('bind_transceiver', function (pdu) {
					session.pause();
					setTimeout(function () {
						session.resume();
						session.send(pdu.response());
					}, 25); // Delayed processing simulation
				});
				// Errors
				session.on('error', function (err) {
					lastServerError = err;
					session.close();
				});
			});
			server.listen(0, done);
			port = server.address().port;
		});

		afterEach(function (done) {
			server.sessions.forEach(function (session) {
				session.close();
			});
			server.close(done);
		});

		it('should successfully have multiple sessions opened at the same time, closing them all afterwards', function (done) {
			var totalConnections = 100;
			var closedConnections = 0;
			for (var i = 0; i < totalConnections; i++) {
				smpp.connect({port: port}, function (session) {
					session.bind_transceiver({}, function (pdu) {
						assert.equal(pdu.command, "bind_transceiver_resp");
						session.close(function () {
							closedConnections++;
						});
					});
				});
			}
			var interval = setInterval( function() {
				var openConnections = 0;
				server.sessions.forEach(function (session) {
					if (!session.closed) openConnections++;
				});
				// Check if all sessions have been closed
				if (openConnections === 0 && closedConnections === totalConnections && server.sessions.length === 0) {
					clearInterval(interval);
					done(); // Test ok
				}
			}, 10);
		});
	});
});
