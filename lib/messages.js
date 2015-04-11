//
// Base class
//
class Message {
  constructor(method) {
    this.method = method
  }
}

//
// State messages
//
export class RemoteReady extends Message {
  constructor() {
    super('remote-ready')
  }
}

export class RemoteError extends Message {
  constructor(error) {
    super('remote-error')
    this.error = error
  }
}

//
// Interaction messages
//
export class Register extends Message {
  constructor(id, name) {
    super('register')
    this.id = id
    this.name = name
  }
}

export class Deregister extends Message {
  constructor(id, name) {
    super('deregister')
    this.id = id
    this.name = name
  }
}

export class Call extends Message {
  constructor(id, name, args) {
    super('call')
    this.id = id
    this.name = name
    this.args = args
  }
}

//
// Promise messages
//
export class Resolve extends Message {
  constructor(id, result) {
    super('resolve')
    this.id = id
    this.result = result
  }
}

export class Reject extends Message {
  constructor(id, error) {
    super('reject')
    this.id = id
    this.error = error
  }
}

export class Progress extends Message {
  constructor(id, progress) {
    super('progress')
    this.id = id
    this.progress = progress
  }
}
