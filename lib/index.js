const Connection = require('./connection')
const Server = require('./server')
const Client = require('./client')

module.exports = {
  Connection,
  Server,
  Client,

  createServer(handler) {
    return new Server(handler)
  },

  createClient(handler) {
    return new Client(handler)
  },

  createConnection(handler) {
    return new Connection(handler)
  }
}
