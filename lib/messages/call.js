import Message from './message'

class Call extends Message {
  constructor(id, name, args) {
    super('call')
    this.id = id
    this.name = name
    this.args = args
  }
}

export default Call
