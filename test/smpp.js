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

describe('enquire_link', function() {
	var server, port, serverSessions;

	function listen(options, done) {
		serverSessions = [];
		server = smpp.createServer(options, function(session) {
			session.on('error', function() {}); // the tests tear clients down abruptly
			serverSessions.push(session);
		});
		server.listen(0, done);
		port = server.address().port;
	}

	afterEach(function(done) {
		server.sessions.forEach(function(session) {
			session.destroy();
		});
		server.close(done);
	});

	describe('auto_enquire_link_response', function() {
		beforeEach(function(done) {
			listen({ auto_enquire_link_response: true }, done);
		});

		it('should answer an incoming enquire_link without a handler', function(done) {
			var session = smpp.connect({ port: port }, function() {
				session.enquire_link(function(pdu) {
					assert.equal(pdu.command, 'enquire_link_resp');
					assert.equal(pdu.command_status, smpp.ESME_ROK);
					session.destroy(done);
				});
			});
		});

		it('should still emit the enquire_link event', function(done) {
			var session = smpp.connect({ port: port }, function() {
				serverSessions[0].on('enquire_link', function(pdu) {
					assert.equal(pdu.command, 'enquire_link');
					session.destroy(done);
				});
				session.enquire_link();
			});
		});

		it('should answer before emitting the events', function(done) {
			var session = smpp.connect({ port: port }, function() {
				var serverSession = serverSessions[0];
				var sent = [];
				var send = serverSession.send;
				serverSession.send = function(pdu) {
					sent.push(pdu.command);
					return send.apply(this, arguments);
				};
				serverSession.on('pdu', function() {
					assert.deepEqual(sent, ['enquire_link_resp']);
				});
				serverSession.on('enquire_link', function() {
					assert.deepEqual(sent, ['enquire_link_resp']);
					session.destroy(done);
				});
				session.enquire_link();
			});
		});

		it('should be switchable at runtime', function(done) {
			var session = smpp.connect({ port: port }, function() {
				serverSessions[0].autoEnquireLinkResponse = false;
				session.enquire_link(function() {
					done(new Error('enquire_link should not have been answered'));
				});
				setTimeout(function() {
					session.destroy(done);
				}, 100);
			});
		});
	});

	describe('enquire_link_timeout', function() {
		beforeEach(function(done) {
			// Nothing on the server side answers enquire_link.
			listen({}, done);
		});

		it('should not answer an incoming enquire_link by default', function(done) {
			var session = smpp.connect({ port: port }, function() {
				session.enquire_link(function() {
					done(new Error('enquire_link should not have been answered'));
				});
				setTimeout(function() {
					session.destroy(done);
				}, 100);
			});
		});

		it('should emit enquire_link_timeout and close the session when no response arrives', function(done) {
			var timedOut = null;
			var session = smpp.connect({
				port: port,
				auto_enquire_link_period: 20,
				enquire_link_timeout: 50
			});
			session.on('enquire_link_timeout', function(pdu) {
				assert.equal(timedOut, null, 'only one timeout is expected before the session closes');
				timedOut = pdu;
			});
			session.on('close', function() {
				assert.ok(timedOut, 'enquire_link_timeout was not emitted');
				assert.equal(timedOut.command, 'enquire_link');
				assert.equal(timedOut.sequence_number, 1);
				done();
			});
		});

		it('should keep the session open when close_on_enquire_link_timeout is false', function(done) {
			var timeouts = 0;
			var session = smpp.connect({
				port: port,
				auto_enquire_link_period: 20,
				enquire_link_timeout: 30,
				close_on_enquire_link_timeout: false
			});
			session.on('close', function() {
				if (timeouts < 3) done(new Error('session closed on enquire_link timeout'));
			});
			session.on('enquire_link_timeout', function(pdu) {
				assert.equal(session._callbacks[pdu.sequence_number], undefined, 'the timed out callback was kept');
				if (++timeouts === 3) {
					// At most the enquire_link sent after the one that just timed out is still awaited.
					assert.ok(session._enquireLinkTimers.size <= 1, 'fired timers were kept: ' + session._enquireLinkTimers.size);
					session.destroy(done);
				}
			});
		});

		it('should not keep callbacks for enquire_link when no timeout is set', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period: 10 }, function() {
				var received = 0;
				serverSessions[0].on('enquire_link', function() {
					if (++received === 3) {
						assert.deepEqual(Object.keys(session._callbacks), []);
						session.destroy(done);
					}
				});
			});
		});

		it('should take the timeout from the option when startEnquireLink() is not given one', function(done) {
			var session = smpp.connect({ port: port, enquire_link_timeout: 30 }, function() {
				session.startEnquireLink(10);
			});
			session.on('close', done);
		});

		it('should ignore a negative timeout option', function(done) {
			var session = smpp.connect({
				port: port,
				auto_enquire_link_period: 10,
				enquire_link_timeout: -1
			}, function() {
				serverSessions[0].on('enquire_link', function(pdu) {
					serverSessions[0].send(pdu.response());
				});
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link timed out'));
			});
			setTimeout(function() {
				session.destroy(done);
			}, 150);
		});

		it('should start a schedule requested before the connection is established', function(done) {
			var connected = false;
			var session = smpp.connect({ port: port }, function() {
				connected = true;
				serverSessions[0].on('enquire_link', function() {
					session.destroy(done);
				});
			});
			session.on('debug', function(type) {
				if (type === 'pdu.command.out') {
					assert.ok(connected, 'enquire_link was sent before the connection was established');
				}
			});
			session.startEnquireLink(1);
			assert.equal(session._interval, 0, 'the schedule started before the connection was established');
		});

		it('should ignore a negative timeout given to startEnquireLink()', function(done) {
			var session = smpp.connect({ port: port }, function() {
				serverSessions[0].on('enquire_link', function(pdu) {
					serverSessions[0].send(pdu.response());
				});
				session.startEnquireLink(10, -5);
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link timed out'));
			});
			setTimeout(function() {
				session.destroy(done);
			}, 100);
		});

		it('should not wait for a response to an enquire_link that could not be written', function(done) {
			var session = smpp.connect({ port: port }, function() {
				session.socket.write = function(buffer, callback) {
					process.nextTick(callback, new Error('write failed'));
					return false;
				};
				session.startEnquireLink(10, 30);
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link_timeout emitted for an enquire_link that was never written'));
			});
			setTimeout(function() {
				assert.equal(session._enquireLinkTimers.size, 0);
				session.destroy(done);
			}, 120);
		});

		// A peer that stopped answering and doesn't close its side of the connection either.
		function withDeadPeer(test) {
			return function(done) {
				var net = require('net');
				var sockets = [];
				var deadPeer = net.createServer({ allowHalfOpen: true }, function(socket) {
					sockets.push(socket);
				});
				deadPeer.listen(0, function() {
					test(deadPeer.address().port, function(err) {
						sockets.forEach(function(socket) {
							socket.destroy();
						});
						deadPeer.close(function() {
							done(err);
						});
					});
				});
			};
		}

		it('should keep waiting for the responses after close() and drop a half-open peer', withDeadPeer(function(deadPort, done) {
			var timedOut = false;
			var session = smpp.connect({
				port: deadPort,
				auto_enquire_link_period: 10,
				enquire_link_timeout: 50
			});
			session.once('send', function() {
				session.close();
			});
			session.on('enquire_link_timeout', function() {
				timedOut = true;
			});
			session.on('close', function() {
				assert.ok(timedOut, 'the session was not dropped by the enquire_link timeout');
				done();
			});
		}));

		it('should keep waiting for the responses when the schedule is replaced', withDeadPeer(function(deadPort, done) {
			var timedOut = false;
			var session = smpp.connect({
				port: deadPort,
				auto_enquire_link_period: 10,
				enquire_link_timeout: 50
			});
			session.once('send', function() {
				session.close();
				session.startEnquireLink(10, 50);
				assert.equal(session._enquireLinkTimers.size, 1, 'the awaited enquire_link was forgotten');
			});
			session.on('enquire_link_timeout', function() {
				timedOut = true;
			});
			session.on('close', function() {
				assert.ok(timedOut, 'the session was not dropped by the enquire_link timeout');
				done();
			});
		}));

		it('should not wait for a response to an enquire_link that failed to send synchronously', withDeadPeer(function(deadPort, done) {
			var session = smpp.connect({
				port: deadPort,
				auto_enquire_link_period: 10,
				enquire_link_timeout: 20
			}, function() {
				setImmediate(function() {
					// Unlike close(), this leaves the keepalive running against a socket that is no longer writable.
					session.socket.end();
				});
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link_timeout emitted for an enquire_link that was never sent'));
			});
			setTimeout(function() {
				assert.equal(session._enquireLinkTimers.size, 0);
				session.destroy();
				done();
			}, 100);
		}));

		it('should stop the keepalive synchronously on destroy()', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period: 10, enquire_link_timeout: 1000 }, function() {
				session.once('send', function() {
					session.destroy();
					assert.equal(session._interval, 0);
					assert.equal(session._enquireLinkTimers.size, 0);
					done();
				});
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link_timeout emitted after destroy()'));
			});
		});

		it('should not start sending enquire_link when closed from the connect listener', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period: 10 }, function() {
				session.close();
				setImmediate(function() {
					assert.equal(session._interval, 0, 'the interval was started after close()');
					done();
				});
			});
		});

		it('should stop sending enquire_link once the peer closes the session', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period: 10 }, function() {
				serverSessions[0].destroy();
			});
			session.on('close', function() {
				setTimeout(function() {
					assert.equal(session._interval, 0, 'the interval survived the close');
					done();
				}, 30);
			});
		});

		it('should stop sending enquire_link once the session is closed', function(done) {
			var session = smpp.connect({ port: port, auto_enquire_link_period: 10 }, function() {
				setTimeout(function() {
					assert.notEqual(session._interval, 0, 'the interval did not start');
					session.close();
					assert.equal(session._interval, 0, 'close() kept the interval');
				}, 5);
			});
			session.on('close', function() {
				setTimeout(function() {
					assert.equal(session._interval, 0, 'the interval survived the close');
					done();
				}, 30);
			});
		});

		it('should not time out when the peer answers', function(done) {
			var responses = 0;
			var session = smpp.connect({
				port: port,
				auto_enquire_link_period: 20,
				enquire_link_timeout: 200
			}, function() {
				serverSessions[0].on('enquire_link', function(pdu) {
					serverSessions[0].send(pdu.response());
				});
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link timed out'));
			});
			session.on('enquire_link_resp', function() {
				responses++;
			});
			setTimeout(function() {
				assert.ok(responses >= 3, 'expected at least 3 responses, got ' + responses);
				session.destroy(done);
			}, 250);
		});

		it('should be startable and stoppable at runtime', function(done) {
			var sent = 0;
			var session = smpp.connect({ port: port }, function() {
				serverSessions[0].on('enquire_link', function(pdu) {
					sent++;
					serverSessions[0].send(pdu.response());
				});
				session.startEnquireLink(20, 50);
				setTimeout(function() {
					assert.ok(sent >= 2, 'expected enquire_link to be sent, got ' + sent);
					session.stopEnquireLink();
					var sentWhenStopped = sent;
					setTimeout(function() {
						// One enquire_link may have been in flight when stopping.
						assert.ok(sent <= sentWhenStopped + 1, 'enquire_link kept being sent after stopEnquireLink()');
						session.destroy(done);
					}, 100);
				}, 100);
			});
		});

		it('should forget the awaited response when stopped', function(done) {
			var session = smpp.connect({ port: port }, function() {
				session.startEnquireLink(10, 50);
				setTimeout(function() {
					session.stopEnquireLink();
					assert.deepEqual(Object.keys(session._callbacks), [], 'stopEnquireLink() kept response callbacks');
				}, 15);
				setTimeout(function() {
					assert.ok(!session.closed, 'session was closed after stopEnquireLink()');
					session.destroy(done);
				}, 150);
			});
			session.on('enquire_link_timeout', function() {
				done(new Error('enquire_link_timeout emitted after stopEnquireLink()'));
			});
		});

		it('should reject a non-positive period', function(done) {
			var session = smpp.connect({ port: port }, function() {
				assert.throws(function() {
					session.startEnquireLink(0);
				}, TypeError);
				session.destroy(done);
			});
		});
	});

	describe('server sessions', function() {
		beforeEach(function(done) {
			listen({ auto_enquire_link_period: 20, enquire_link_timeout: 50 }, done);
		});

		it('should drop a client that does not answer enquire_link', function(done) {
			var serverTimedOut = false;
			var session = smpp.connect({ port: port }, function() {
				serverSessions[0].on('enquire_link_timeout', function() {
					serverTimedOut = true;
				});
			});
			session.on('error', function() {});
			session.on('close', function() {
				assert.ok(serverTimedOut, 'server session did not report the timeout');
				done();
			});
		});

		it('should keep a silent client when close_on_enquire_link_timeout is false', function(done) {
			server.close();
			listen({ auto_enquire_link_period: 10, enquire_link_timeout: 20, close_on_enquire_link_timeout: false }, function() {
				var timeouts = 0;
				var session = smpp.connect({ port: port }, function() {
					serverSessions[0].on('enquire_link_timeout', function() {
						if (++timeouts === 3) {
							session.destroy(done);
						}
					});
				});
				session.on('error', function() {});
				session.on('close', function() {
					if (timeouts < 3) done(new Error('server dropped the client'));
				});
			});
		});

		it('should keep a client that answers enquire_link', function(done) {
			var received = 0;
			var session = smpp.connect({ port: port, auto_enquire_link_response: true });
			session.on('enquire_link', function() {
				received++;
			});
			session.on('close', function() {
				done(new Error('session was closed'));
			});
			setTimeout(function() {
				assert.ok(received >= 3, 'expected at least 3 enquire_link, got ' + received);
				session.removeAllListeners('close');
				session.destroy(done);
			}, 250);
		});
	});
});
