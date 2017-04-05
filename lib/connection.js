const Promise = require('bluebird')
const { Duplex } = require('stream')
const slice = require('sliced')
const {
  Call,
  Deregister,
  Register,
  Reject,
  Resolve,
  RemoteReady,
  RemoteError
} = require('./messages')

const sandbox = fn => new Promise(resolve => resolve(fn()))

class Connection extends Duplex {

  constructor(handler) {
    super({
      readableObjectMode: true,
      writableObjectMode: true,
      allowHalfOpen: false
    })

    this._readyForMore = true
    this.remoteReady = false
    this._watching = {}
    this._queue = []
    this._local = {}
    this.remote = {}

    // Run handler in sandbox
    sandbox(() => handler(this, this.remote)).then(
      () => this.notify(new RemoteReady()),
      err => this.notify(new RemoteError(err))
    )
  }

  //
  // Allow waiting for connection readiness
  //
  then() {
    var p = this.remoteReady
      ? Promise.resolve()
      : this.waitFor({ id: 'ready' })

    return p.then.apply(p, arguments)
  }

  //
  // Call an RPC function on the remote and get the result
  //
  call(name, args) {
    return this.notifyAndWaitFor(new Call(name, args))
  }

  //
  // Register an RPC function and notify the remote
  //
  register(name, fn) {
    if (this._local[name]) {
      return Promise.reject(`method "${name}" already exists`)
    }

    if (typeof fn !== 'function') {
      return Promise.reject('Could not register invalid function')
    }

    this._local[name] = fn

    return this.notifyAndWaitFor(new Register(name))
  }

  //
  // Deregister an RPC function and notify the remote
  //
  deregister(name) {
    if (!this._local[name]) {
      return Promise.reject(`${name} does not exist`)
    }

    // Don't delete until the deregister has been acknowledged
    return this.notifyAndWaitFor(new Deregister(name))
      .then(() => delete this._local[name])
  }

  //
  // Listen for promise response events related to specified message
  //
  waitFor(msg) {
    return new Promise((resolve, reject) => {
      this._watching[msg.id] = {
        resolve: res => {
          delete this._watching[msg.id]
          resolve(res)
        },
        reject: res => {
          delete this._watching[msg.id]
          reject(res)
        }
      }
    })
  }

  //
  // Queue a message
  //
  notify(msg) {
    if (this._readyForMore) {
      this._readyForMore = this.push(msg)
    } else {
      this._queue.push(msg)
      this._read(0)
    }
  }

  //
  // Queue a message and wait for a response
  //
  notifyAndWaitFor(msg) {
    const p = this.waitFor(msg)
    this.notify(msg)
    return p
  }

  //
  // This is where messages get pulled out of the queue
  //
  _read(size) {
    var more = false
    while (this._queue.length) {
      var msg = this._queue.shift()
      if (!(more = this.push(msg))) {
        break
      }
    }
    this._readyForMore = more
  }

  //
  // This is where received messages get processed
  //
  _writeRemoteReady(msg, callback) {
    var wait = this._watching.ready
    this.remoteReady = true
    if (wait) wait.resolve(msg.result)
    callback()
  }

  _writeRemoteError(msg, callback) {
    var wait = this._watching.ready
    this.remoteReady = false
    if (wait) wait.reject(msg.error)
    callback()
  }

  _writeRegister(msg, callback) {
    if (this.remote[msg.name]) {
      this.notify(new Reject(msg.id, `${msg.name} already exists`))
    } else {
      // Create a function that proxies to `call`
      this.remote[msg.name] = (...args) => this.call(msg.name, args)
      this.notify(new Resolve(msg.id))
    }
    callback()
  }

  _writeDeregister(msg, callback) {
    if (!this.remote[msg.name]) {
      this.notify(new Reject(msg.id, `${msg.name} does not exist`))
    } else {
      // Deregister the function
      delete this.remote[msg.name]
      this.notify(new Resolve(msg.id))
    }
    callback()
  }

  _writeCall(msg, callback) {
    let fn = this._local[msg.name]
    if (!fn) {
      this.notify(new Reject(msg.id, `${msg.name} does not exist`))
    } else {
      // Call the function in a sandbox
      sandbox(() => fn.apply(null, msg.args)).then(
        res => this.notify(new Resolve(msg.id, res)),
        err => this.notify(new Reject(msg.id, err))
      )
    }

    callback()
  }

  _writeResolve(msg, callback) {
    this._watching[msg.id].resolve(msg.result)
    callback()
  }

  _writeReject(msg, callback) {
    this._watching[msg.id].reject(msg.error)
    callback()
  }

  _write(msg, encoding, callback) {
    switch (msg.method) {
      // Remote state emitters
      case 'remote-ready':
        this._writeRemoteReady(msg, callback)
        break

      case 'remote-error':
        this._writeRemoteError(msg, callback)
        break

      // API interactions
      case 'register':
        this._writeRegister(msg, callback)
        break

      case 'deregister':
        this._writeDeregister(msg, callback)
        break

      case 'call':
        this._writeCall(msg, callback)
        break

      // Promise state emitters
      case 'resolve':
        this._writeResolve(msg, callback)
        break

      case 'reject':
        this._writeReject(msg, callback)
        break
    }
  }

}
module.exports = Connection
