const { createServer, createClient } = require('../lib')
const Promise = require('bluebird')
const { expect } = require('chai')

describe('basics', () => {

  // Delay promise
  function delayAnd(n) {
    return new Promise(resolve => {
      setTimeout(resolve, n)
    })
  }

  // Make a client for supplied server
  function clientFor(server, fn) {
    var client = createClient(fn)
    var conn = server.createConnection()
    client.pipe(conn).pipe(client)
    return client
  }

  it('should support optional startup handlers', () => {
    var server = createServer(session => {
      return session.register('test', () => Promise.resolve())
    })

    var client = clientFor(server)

    return client.then(() => client.test())
  })

  it('should properly wait for startup handlers', () => {
    var server = createServer(session => {
      return session.register('ping', n => {
        return session
          .then(() => delayAnd(n))
          .then(() => session.pong(n * 2))
      })
    })

    var client = clientFor(server, session => {
      return session.register('pong', delayAnd)
    })

    return client.then(() => client.ping(50))
  })

  it('should support immediate functions', () => {
    var server = createServer(session => {
      return session.register('hello', name => `Hello, ${name}!`)
    })

    var client = clientFor(server)

    return client
      .then(() => client.hello('world'))
      .then(v => expect(v).to.equal('Hello, world!'))
  })

  it('should support evolving interface', () => {
    var server = createServer(session => {
      var name

      return session.register('login', v => {
        name = v
        return Promise.all([
          session.deregister('login'),
          session.register('secret', () => `You said "${name}".`)
        ])
      })
    })

    var client = clientFor(server)

    return client
      .then(() => client.login('hello'))
      .then(() => client.secret())
      .then(v => expect(v).to.equal('You said "hello".'))
  })

})
