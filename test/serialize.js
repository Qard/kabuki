import { createServer, createClient } from '../dist/index'
import { encode, decode } from './helper'
import Promise from 'bluebird'

function delayAnd (n) {
  return new Promise((resolve) => {
    setTimeout(resolve, n)
  })
}

describe('serialization', () => {

  it('should support work through binary serialized streams', () => {
    let master = createServer((session) => {
      return session.register('hello', (name) => {
        return `Hello, ${name}!`
      })
    })

    // Create client
    let slave = createClient()

    // Connect client to a server connection
    var conn = master.createConnection()
    slave
      .pipe(encode())
      .pipe(decode())
      .pipe(conn)
      .pipe(encode())
      .pipe(decode())
      .pipe(slave)

    // Wait for the interface to be ready and then ping
    return slave
      .then(() => slave.hello('world'))
      .then((v) => v.should.equal('Hello, world!'))
  })

})
