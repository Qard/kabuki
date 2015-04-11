import Promise from 'bluebird'
import {Duplex} from 'stream'
import slice from 'sliced'
import uuid from 'uuid'
import {
  Call,
  Deregister,
  Progress,
  Register,
  Reject,
  Resolve,
  RemoteReady,
  RemoteError
} from './messages'

class Connection extends Duplex {

  constructor(handler) {
    this.readyForMore = true
    this.remoteReady = false
    this.watching = {}
    this.queue = []
    this.api = {}

    super({
      readableObjectMode: true,
      writableObjectMode: true,
      allowHalfOpen: false
    })

    // Run handler
    this._runHandler(handler)
  }

  //
  // Allow waiting for connection readiness
  //
  then() {
    let p = new Promise((resolve, reject) => {
      if (this.remoteReady) return resolve()
      this._watchMessage({ id: 'ready' }, resolve, reject)
    })

    return p.then.apply(p, arguments)
  }

  //
  // Call an RPC function on the remote and get the result
  //
  call(name, args) {
    return new Promise((resolve, reject, progress) => {
      let msg = new Call(uuid.v4(), name, args)
      this._watchMessage(msg, resolve, reject, progress)
      this._queue(msg)
    })
  }

  //
  // Register an RPC function and notify the remote
  //
  register(name, fn) {
    if (this.api[name]) {
      return Promise.reject(name + ' already exists')
    }

    if (typeof fn !== 'function') {
      return Promise.reject('Could not register invalid function')
    }

    this.api[name] = fn

    return new Promise((resolve, reject, progress) => {
      let msg = new Register(uuid.v4(), name)
      this._watchMessage(msg, resolve, reject, progress)
      this._queue(msg)
    })
  }

  //
  // Deregister an RPC function and notify the remote
  //
  deregister(name) {
    if ( ! this.api[name]) {
      return Promise.reject(name + ' does not exist')
    }

    let p = new Promise((resolve, reject, progress) => {
      let msg = new Deregister(uuid.v4(), name)
      this._watchMessage(msg, resolve, reject, progress)
      this._queue(msg)
    })

    // Don't delete until the deregister has been acknowledged
    return p.then(() => delete this.api[name])
  }

  //
  // Listen for promise response events related to specified message
  //
  _watchMessage(msg, resolve, reject, progress) {
    this.watching[msg.id] = {
      progress: progress,
      resolve: (res) => {
        delete this.watching[msg.id]
        resolve(res)
      },
      reject: (res) => {
        delete this.watching[msg.id]
        reject(res)
      }
    }
  }

  //
  // Run initial handler in sandbox
  //
  _runHandler(handler) {
    sandbox(() => handler(this)).then(
      () => this._queue(new RemoteReady()),
      (err) => this._queue(new RemoteError(err))
    )
  }

  //
  // Queue a message
  //
  _queue(msg) {
    if (this.readyForMore) {
      this.readyForMore = this.push(msg)
    } else {
      this.queue.push(msg)
      this._read(0)
    }
  }

  //
  // This is where messages get pulled out of the queue
  //
  _read(size) {
    while (this.queue.length) {
      let msg = this.queue.shift()
      if ( ! this.push(msg)) break
    }
    this.readyForMore = false
  }

  //
  // This is where received messages get processed
  //
  _write(msg, encoding, callback) {
    let wait = this.watching.ready
    switch (msg.method) {
      // Remote state emitters
      case 'remote-ready':
        this.remoteReady = true
        if (wait) wait.resolve(msg.result)
        break

      case 'remote-error':
        this.remoteReady = false
        if (wait) wait.reject(msg.error)
        break

      // API interactions
      case 'register':
        if (this[msg.name]) {
          this._queue(new Reject(msg.id, msg.name + ' already exists'))
          break
        }

        // Create a function that proxies to `call`
        this[msg.name] = function () {
          return this.call(msg.name, slice(arguments))
        }
        this._queue(new Resolve(msg.id))
        break

      case 'deregister':
        if ( ! this[msg.name]) {
          this._queue(new Reject(msg.id, msg.name + ' does not exist'))
          break
        }

        // Deregister the function
        delete this[msg.name]
        this._queue(new Resolve(msg.id))
        break

      case 'call':
        let fn = this.api[msg.name]
        if ( ! fn) {
          this._queue(new Reject(msg.id, msg.name + ' does not exist'))
          break
        }

        // Call the function in a sandbox
        sandbox(function () {
          return fn.apply(null, msg.args)
        }).then(
          (res) => this._queue(new Resolve(msg.id, res)),
          (err) => this._queue(new Reject(msg.id, err))
        )

        break

      // Promise state emitters
      case 'resolve':
        this.watching[msg.id].resolve(msg.result)
        break

      case 'reject':
        this.watching[msg.id].reject(msg.error)
        break

      case 'progress':
        this.watching[msg.id].progress(msg.progress)
        break
    }
    callback()
  }

}

function sandbox (fn) {
  return new Promise((resolve) => resolve(fn()))
}

export default Connection
