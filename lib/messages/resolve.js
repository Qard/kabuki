import Message from './message'

class Resolve extends Message {
  constructor(id, result) {
    super('resolve')
    this.id = id
    this.result = result
  }
}

export default Resolve
