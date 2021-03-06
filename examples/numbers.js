const { createServer, createClient } = require('../')
const Promise = require('bluebird')
const assert = require('assert')

var server = createServer((session, remote) => {
  var values = []

  //
  // The server registers a function to push to a list of numbers
  //
  return session.register('insert', n => {
    values.push(n)
    return remote.sum(values).then(sum => ({ values, sum }))
  })
})

var client = createClient((session, remote) => {
  //
  // The client registers a function to sum the values of a list
  //
  return session.register('sum', values => {
    return values.reduce((m, v) => m + v, 0)
  })
})

var conn = server.createConnection()
client.pipe(conn).pipe(client)

client
  //
  // When `push` is called, it will add the item to the server-side list
  // and then it will call back to our `sum` function to  produce a sum
  //
  .then(() => client.remote.insert(2))
  .then(result => {
    assert(result.values.length === 1)
    assert(result.sum === 2)
  })
  //
  // On subsequent calls, the list state will persist and thus grow
  //
  .then(() => client.remote.insert(4))
  .then(result => {
    assert(result.values.length === 2)
    assert(result.sum === 6)
  })
  .then(() => {
    console.log('success')
  })
