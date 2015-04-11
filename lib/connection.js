import { Call, Deregister, Progress, Register, Reject, Resolve } from './messages'
import Promise from 'bluebird'
import {Duplex} from 'stream'
import slice from 'sliced'
import uuid from 'uuid'

class Connection extends Duplex {

  constructor(handler) {
    this.readyForMore = true
    this.remoteReady = false
    this.queue = []
    this.api = {}

    super({
      readableObjectMode: true,
      writableObjectMode: true,
      allowHalfOpen: false
    })

    // Watch for remote readiness and set a ready flag
    this.once('remote-error', () => this.remoteReady = false)
    this.once('remote-ready', () => this.remoteReady = true)


    // Run handler in promise sandbox
    let p = new Promise((resolve, reject) => {
      resolve(handler && handler(this))
    })

    // Figure out what to do with the result
    p.then(
      () => this._queue({ method: 'remote-ready' }),
      (e) => this._queue({ method: 'remote-error', error: e })
    )
  }

  //
  // Allow waiting for connection readiness
  //
  then() {
    let p = new Promise((resolve, reject) => {
      if (this.remoteReady) return resolve()

      let handlers = {
        resolve: withCleanup(this, resolve),
        reject: withCleanup(this, reject)
      }

      function withCleanup (ctx, done) {
        return function (res) {
          ctx.removeListener('remote-ready', handlers.resolve)
          ctx.removeListener('remote-error', handlers.reject)
          done(res)
        }
      }

      this.on('remote-ready', handlers.resolve)
      this.on('remote-error', handlers.reject)
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

    if ( ! fn) {
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
    let handle = {
      resolve: withCleanup(this, resolve),
      reject: withCleanup(this, reject)
    }

    this.on(`resolve:${msg.id}`, handle.resolve)
    this.on(`reject:${msg.id}`, handle.reject)
    if (progress) {
      this.on(`progress:${msg.id}`, progress)
    }

    function withCleanup (ctx, done) {
      return function (res) {
        ctx.removeListener(`resolve:${msg.id}`, handle.resolve)
        ctx.removeListener(`reject:${msg.id}`, handle.reject)
        if (progress) {
          ctx.removeListener(`progress:${msg.id}`, progress)
        }
        done(res)
      }
    }
  }

  //
  // Remote promise responders
  //
  _resolve(id, res) {
    this._queue(new Resolve(id, res))
  }

  _reject(id, err) {
    this._queue(new Reject(id, err))
  }

  _progress(id, prog) {
    this._queue(new Progress(id, prog))
  }

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
    switch (msg.method) {
      // Remote state emitters
      case 'remote-ready':
        this.emit('remote-ready')
        break

      case 'remote-error':
        this.emit('remote-error', msg.error)
        break

      // API interactions
      case 'register':
        if (this[msg.name]) {
          this._reject(msg.id, msg.name + ' already exists')
          break
        }

        // Create a function that proxies to `call`
        this[msg.name] = function () {
          return this.call(msg.name, slice(arguments))
        }
        this._resolve(msg.id)
        break

      case 'deregister':
        if ( ! this[msg.name]) {
          this._reject(msg.id, msg.name + ' does not exist')
          break
        }

        // Deregister the function
        delete this[msg.name]
        this._resolve(msg.id)
        break

      case 'call':
        let fn = this.api[msg.name]
        if ( ! fn) {
          this._reject(msg.id, msg.name + ' does not exist')
          break
        }

        // Call the function
        let p = new Promise((resolve) => {
          resolve(fn.apply(null, msg.args))
        })

        // Pass along success or error
        p.then(
          (res) => this._resolve(msg.id, res),
          (err) => this._reject(msg.id, err)
        )

        break

      // Promise state emitters
      case 'resolve':
        this.emit(`resolve:${msg.id}`, msg.result)
        break

      case 'reject':
        this.emit(`reject:${msg.id}`, msg.error)
        break

      case 'progress':
        this.emit(`progress:${msg.id}`, msg.progress)
        break
    }
    callback()
  }

}

export default Connection
