import Message from './message'

class Reject extends Message {
  constructor(id, error) {
    super('reject')
    this.id = id
    this.error = error
  }
}

export default Reject
