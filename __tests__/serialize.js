const { createServer, createClient } = require('../lib')
const { encode, decode } = require('../test_helpers/helper')
const Promise = require('bluebird')
const { expect } = require('chai')
const http = require('http')
const net = require('net')

const delayAnd = n => new Promise(resolve => setTimeout(resolve, n))

describe('serialization', () => {

  it('should support work via binary serialized streams', () => {
    var rpcServer = createServer(session => {
      return session.register('hello', name => `Hello, ${name}!`)
    })

    // Create client
    var rpcClient = createClient()

    // Connect client to a server connection
    var conn = rpcServer.createConnection()
    rpcClient
      .pipe(encode())
      .pipe(decode())
      .pipe(conn)
      .pipe(encode())
      .pipe(decode())
      .pipe(rpcClient)

    // Wait for the interface to be ready and then ping
    return rpcClient
      .then(() => rpcClient.hello('world'))
      .then(v => expect(v).to.equal('Hello, world!'))
  })

  it('should support work via http', () => {
    // Create RPC server
    var rpcServer = createServer(session => {
      return session.register('hello', name => `Hello, ${name}!`)
    })

    // Create HTTP server
    var httpServer = http.createServer((req, res) => {
      var conn = rpcServer.createConnection()
      var e = encode()
      var d = decode()
      req.pipe(d).pipe(conn).pipe(e).pipe(res)
    })

    // Start listening on a port
    var p = new Promise(resolve => {
      httpServer.listen(() => resolve(httpServer.address()))
    })

    // Wait until server is ready
    return p.then((add) => {
      // Create RPC client
      var rpcClient = createClient()

      // Create HTTP Client
      var res = http.request({
        method: 'POST',
        host: 'localhost',
        port: add.port
      }, req => {
        // Pipe incoming messages from request
        req.pipe(decode()).pipe(rpcClient)
      })

      // Pipe outgoing messages into request
      rpcClient.pipe(encode()).pipe(res)

      // Wait for the interface to be ready and then ping
      return rpcClient
        .then(() => rpcClient.hello('world'))
        .then(v => expect(v).to.equal('Hello, world!'))
        .then(() => res.abort())
    }).then(() => {
      return new Promise(resolve => httpServer.close(resolve))
    })
  })

  it('should support work via net', () => {
    // Create RPC server
    var rpcServer = createServer(session => {
      return session.register('hello', name => `Hello, ${name}!`)
    })

    // Create TCP server
    var netServer = net.createServer(s => {
      var conn = rpcServer.createConnection()
      var e = encode()
      var d = decode()
      s.pipe(d).pipe(conn).pipe(e).pipe(s)
    })

    // Start listening on a port
    var p = new Promise(resolve => {
      netServer.listen(() => resolve(netServer.address()))
    })

    // Wait until server is ready
    return p.then(add => {
      // Create RPC client
      var rpcClient = createClient()

      // Create TCP Client
      var s = net.connect(add.port)
      var e = encode()
      var d = decode()
      s.pipe(d).pipe(rpcClient).pipe(e).pipe(s)

      // Wait for the interface to be ready and then ping
      return rpcClient
        .then(() => rpcClient.hello('world'))
        .then(v => expect(v).to.equal('Hello, world!'))
        .then(() => s.end())
    }).then(() => {
      return new Promise(resolve => netServer.close(resolve))
    })
  })

})
