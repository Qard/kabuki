const uuid = require('uuid')

//
// Base class
//
class Message {
  constructor(id, method) {
    this.method = method
    this.id = id
  }
}
class AutoIdMessage extends Message {
  constructor(method) {
    super(uuid.v4(), method)
  }
}

//
// State messages
//
class RemoteReady extends AutoIdMessage {
  constructor() {
    super('remote-ready')
  }
}
exports.RemoteReady = RemoteReady

class RemoteError extends AutoIdMessage {
  constructor(error) {
    super('remote-error')
    this.error = error
  }
}
exports.RemoteError = RemoteError

//
// Interaction messages
//
class MethodMessage extends AutoIdMessage {
  constructor(method, name) {
    super(method)
    this.name = name
  }
}
class Register extends MethodMessage {
  constructor(name) {
    super('register', name)
  }
}
exports.Register = Register

class Deregister extends MethodMessage {
  constructor(name) {
    super('deregister', name)
  }
}
exports.Deregister = Deregister

class Call extends MethodMessage {
  constructor(name, args) {
    super('call', name)
    this.args = args
  }
}
exports.Call = Call

//
// Promise messages
//
class Resolve extends Message {
  constructor(id, result) {
    super(id, 'resolve')
    this.result = result
  }
}
exports.Resolve = Resolve

class Reject extends Message {
  constructor(id, error) {
    super(id, 'reject')
    this.error = error
  }
}
exports.Reject = Reject
