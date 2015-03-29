import Message from './message'

class Register extends Message {
  constructor(id, name) {
    super('register')
    this.id = id
    this.name = name
  }
}

export default Register
