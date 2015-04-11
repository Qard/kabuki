import { createServer, createClient } from '../dist/index'
import { encode, decode } from './helper'
import Promise from 'bluebird'
import http from 'http'
import net from 'net'

function delayAnd (n) {
  return new Promise((resolve) => {
    setTimeout(resolve, n)
  })
}

describe('serialization', () => {

  it('should support work via binary serialized streams', () => {
    let rpcServer = createServer((session) => {
      return session.register('hello', (name) => {
        return `Hello, ${name}!`
      })
    })

    // Create client
    let rpcClient = createClient()

    // Connect client to a server connection
    let conn = rpcServer.createConnection()
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
      .then((v) => v.should.equal('Hello, world!'))
  })

  it('should support work via http', () => {
    // Create RPC server
    let rpcServer = createServer((session) => {
      return session.register('hello', (name) => {
        return `Hello, ${name}!`
      })
    })

    // Create HTTP server
    let httpServer = http.createServer((req, res) => {
      let conn = rpcServer.createConnection()
      let e = encode()
      let d = decode()
      req.pipe(d).pipe(conn).pipe(e).pipe(res)
    })

    // Start listening on a port
    let p = new Promise((resolve) => {
      httpServer.listen(() => resolve(httpServer.address()))
    })

    // Wait until server is ready
    return p.then((add) => {
      // Create RPC client
      let rpcClient = createClient()

      // Create HTTP Client
      let res = http.request({
        method: 'POST',
        host: 'localhost',
        port: add.port
      }, (req) => {
        // Pipe incoming messages from request
        req.pipe(decode()).pipe(rpcClient)
      })

      // Pipe outgoing messages into request
      rpcClient.pipe(encode()).pipe(res)

      // Wait for the interface to be ready and then ping
      return rpcClient
        .then(() => rpcClient.hello('world'))
        .then((v) => v.should.equal('Hello, world!'))
        .then(() => res.abort())
    }).then(() => {
      return new Promise((resolve) => httpServer.close(resolve))
    })
  })

  it('should support work via net', () => {
    // Create RPC server
    let rpcServer = createServer((session) => {
      return session.register('hello', (name) => {
        return `Hello, ${name}!`
      })
    })

    // Create TCP server
    let netServer = net.createServer((s) => {
      let conn = rpcServer.createConnection()
      let e = encode()
      let d = decode()
      s.pipe(d).pipe(conn).pipe(e).pipe(s)
    })

    // Start listening on a port
    let p = new Promise((resolve) => {
      netServer.listen(() => resolve(netServer.address()))
    })

    // Wait until server is ready
    return p.then((add) => {
      // Create RPC client
      let rpcClient = createClient()

      // Create TCP Client
      let s = net.connect(add.port)
      let e = encode()
      let d = decode()
      s.pipe(d).pipe(rpcClient).pipe(e).pipe(s)

      // Wait for the interface to be ready and then ping
      return rpcClient
        .then(() => rpcClient.hello('world'))
        .then((v) => v.should.equal('Hello, world!'))
        .then(() => s.end())
    }).then(() => {
      return new Promise((resolve) => netServer.close(resolve))
    })
  })

})
