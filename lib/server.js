import Connection from './connection'

class Server {

  constructor(handler) {
    this.handler = handler
  }

  createConnection() {
    return new Connection(this.handler)
  }

}

export default Server
