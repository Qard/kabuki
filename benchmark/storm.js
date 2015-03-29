import Promise from 'bluebird'
import net from 'net'

import { createServer, createClient } from '..'
import { encode, decode } from '../test/helper'

function echo (v) {
  return v
}

function handleSession (session) {
  return Promise.all([
    session.register('echo', echo)
  ])
}

function promiseBack (fn) {
  return (done) => {
    fn().then(done.bind(null, null), done)
  }
}

suite('direct', () => {
  let server
  let client

  before(() => {
    server = createServer(handleSession)
    client = createClient()

    let conn = server.createConnection()
    client.pipe(conn).pipe(client)
  })

  bench('client.echo("hi")', promiseBack(
    () => client.then(() => client.echo("hi"))
  ))
})

suite('net', () => {
  let netServer
  let netClient
  let server
  let client

  before((done) => {
    server = createServer(handleSession)
    client = createClient()

    let serialize = (a, b) => {
      a
        .pipe(decode())
        .pipe(b)
        .pipe(encode())
        .pipe(a)
    }

    netServer = net.createServer((socket) => {
      serialize(socket, server.createConnection())
    })

    netServer.listen(() => {
      let port = netServer.address().port
      netClient = net.connect(port, () => {
        serialize(netClient, client)
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
    () => client.then(() => client.echo('hi'))
  ))
})
