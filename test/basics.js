import { createServer, createClient } from '../dist/index'
import Promise from 'bluebird'

describe('basics', () => {

  // Delay promise
  function delayAnd (n) {
    return new Promise((resolve) => {
      setTimeout(resolve, n)
    })
  }

  // Make a client for supplied server
  function clientFor (server, fn) {
    let client = createClient(fn)
    let conn = server.createConnection()
    client.pipe(conn).pipe(client)
    return client
  }

  it('should support optional startup handlers', () => {
    let server = createServer((session) => {
      return session.register('test', () => Promise.resolve())
    })

    let client = clientFor(server)

    return client.then(() => client.test())
  })

  it('should properly wait for startup handlers', () => {
    let server = createServer((session) => {
      return session.register('ping', (n) => {
        return session
          .then(() => delayAnd(n))
          .then(() => session.pong(n * 2))
      })
    })

    let client = clientFor(server, (session) => {
      return session.register('pong', delayAnd)
    })

    return client.then(() => client.ping(50))
  })

  it('should support immediate functions', () => {
    let server = createServer((session) => {
      return session.register('hello', (name) => {
        return `Hello, ${name}!`
      })
    })

    let client = clientFor(server)

    return client
    .then(() => client.hello('world'))
    .then((v) => v.should.equal('Hello, world!'))
  })

  it('should support evolving interface', () => {
    let server = createServer((session) => {
      var name

      function login (v) {
        name = v
        return Promise.all([
          session.deregister('login'),
          session.register('secret', secret)
        ])
        .catch((e) => console.log('wat', e))
      }

      function secret () {
        return `You said "${name}".`
      }

      return session.register('login', login)
    })

    let client = clientFor(server)

    return client
      .then(() => client.login('hello'))
      .then(() => client.secret())
      .then((v) => v.should.equal('You said "hello".'))
      .catch((e) => console.log('wat', e))
  })

})
