import Promise from 'bluebird'
import http from 'http'
import net from 'net'

import { createServer, createClient } from '..'
import { encode, decode } from '../test/helper'

suite('direct', () => {
  let rpcServer
  let rpcClient

  before(() => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    let conn = rpcServer.createConnection()
    rpcClient.pipe(conn).pipe(rpcClient)
  })

  bench('client.echo("hi")', promiseBack(
    () => rpcClient.then(() => rpcClient.echo("hi"))
  ))
})

suite('http', () => {
  let httpServer
  let httpClient
  let rpcServer
  let rpcClient

  before((done) => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    httpServer = http.createServer((req, res) => {
      let conn = rpcServer.createConnection()
      let e = encode()
      let d = decode()
      req.pipe(d).pipe(conn).pipe(e).pipe(res)
    })

    httpServer.listen(() => {
      let port = httpServer.address().port

      httpClient = http.request({
        method: 'POST',
        host: 'localhost',
        port: port
      }, (req) => {
        req.pipe(decode()).pipe(rpcClient)
        done()
      })

      rpcClient.pipe(encode()).pipe(httpClient)
    })
  })

  after((done) => {
    httpClient.on('close', done)
    httpClient.abort()
  })

  after((done) => {
    httpServer.close(done)
  })

  bench('client.echo("hi")', promiseBack(
    () => rpcClient.then(() => rpcClient.echo('hi'))
  ))
})

suite('net', () => {
  let netServer
  let netClient
  let rpcServer
  let rpcClient

  before((done) => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    let serialize = (a, b) => {
      let d = decode()
      let e = encode()
      a.pipe(d).pipe(b).pipe(e).pipe(a)
    }

    netServer = net.createServer((socket) => {
      serialize(socket, rpcServer.createConnection())
    })

    netServer.listen(() => {
      let port = netServer.address().port
      netClient = net.connect(port, () => {
        serialize(netClient, rpcClient)
        done()
      })
    })
  })

  after((done) => {
    netClient.on('close', done)
    netClient.end()
  })

  after((done) => {
    netServer.close(done)
  })

  bench('client.echo("hi")', promiseBack(
    () => rpcClient.then(() => rpcClient.echo('hi'))
  ))
})

//
// Helpers
//
function handleSession (session) {
  return session.register('echo', (v) => v)
}

function promiseBack (fn) {
  return (done) => {
    fn().then(() => done(), done)
  }
}
