import Message from './message'

class Deregister extends Message {
  constructor(id, name) {
    super('deregister')
    this.id = id
    this.name = name
  }
}

export default Deregister
