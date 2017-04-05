const Promise = require('bluebird')
const http = require('http')
const net = require('net')

const { createServer, createClient } = require('..')
const { encode, decode } = require('../test_helpers/helper')

suite('direct', () => {
  var rpcServer
  var rpcClient

  before(() => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    var conn = rpcServer.createConnection()
    rpcClient.pipe(conn).pipe(rpcClient)
  })

  bench('client.echo("hi")', promiseBack(
    () => rpcClient.then(() => rpcClient.echo("hi"))
  ))
})

suite('http', () => {
  var httpServer
  var httpClient
  var rpcServer
  var rpcClient

  before(done => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    httpServer = http.createServer((req, res) => {
      var conn = rpcServer.createConnection()
      var e = encode()
      var d = decode()
      req.pipe(d).pipe(conn).pipe(e).pipe(res)
    })

    httpServer.listen(() => {
      var port = httpServer.address().port

      httpClient = http.request({
        method: 'POST',
        host: 'localhost',
        port: port
      }, req => {
        req.pipe(decode()).pipe(rpcClient)
        done()
      })

      rpcClient.pipe(encode()).pipe(httpClient)
    })
  })

  after(done => {
    httpClient.on('close', done)
    httpClient.abort()
  })

  after(done => {
    httpServer.close(done)
  })

  bench('client.echo("hi")', promiseBack(
    () => rpcClient.then(() => rpcClient.echo('hi'))
  ))
})

suite('net', () => {
  var netServer
  var netClient
  var rpcServer
  var rpcClient

  before((done) => {
    rpcServer = createServer(handleSession)
    rpcClient = createClient()

    var serialize = (a, b) => {
      var d = decode()
      var e = encode()
      a.pipe(d).pipe(b).pipe(e).pipe(a)
    }

    netServer = net.createServer(socket => {
      serialize(socket, rpcServer.createConnection())
    })

    netServer.listen(() => {
      var port = netServer.address().port
      netClient = net.connect(port, () => {
        serialize(netClient, rpcClient)
        done()
      })
    })
  })

  after(done => {
    netClient.on('close', done)
    netClient.end()
  })

  after(done => {
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
  return session.register('echo', v => v)
}

function promiseBack (fn) {
  return done => {
    fn().then(() => done(), done)
  }
}
