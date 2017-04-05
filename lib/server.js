const Connection = require('./connection')

class Server {
  constructor(handler) {
    this.handler = handler
  }

  createConnection() {
    return new Connection(this.handler)
  }
}
module.exports = Server
