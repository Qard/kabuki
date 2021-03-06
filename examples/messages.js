const { createServer, createClient } = require('../')
const Promise = require('bluebird')
const assert = require('assert')
const uuid = require('uuid')

//
// User model
//
var users = []
class User {

  constructor(data) {
    this.id = uuid.v4()
    this.name = data.name
    this.pass = data.pass
  }

  static create(name, pass) {
    var user = new User({ name, pass })
    users.push(user)
    return Promise.resolve(user)
  }

  static login(name, pass) {
    var user = users.filter((u) => {
      return u.name == name && u.pass == pass
    })

    if ( ! user.length) {
      return Promise.reject('Authentication failed')
    }

    return Promise.resolve(user[0])
  }

}

//
// Post model
//
var posts = []
class Post {

  constructor(data) {
    this.id = uuid.v4()
    this.content = data.content
  }

  static create(data) {
    var post = new Post(data)
    posts.push(post)
    return Promise.resolve(post)
  }

  static find(data) {
    var found = posts.filter(post => {
      return Object.keys(data)
        .reduce((m, key) => m && post[key] == data[key], true)
    })

    return Promise.resolve(found)
  }

}

//
// RPC interface
//
var server = createServer((session, remote) => {
  var state = {}

  //
  // The guest interface lets only lets you create an account or login
  //
  function guest() {
    // After either path, store user record and enter user interface
    function loggedIn(user) {
      state.user = user
      return enter().then(() => user)
    }

    return Promise.all([
      session.register('createAccount', (name, pass) => {
        return User.create(name, pass).then(loggedIn)
      }),
      session.register('login', (name, pass) => {
        return User.login(name, pass).then(loggedIn)
      })
    ])
  }

  //
  // When the user becomes authorized, turn off the guest interface
  // and switch them to the authenticated interface
  //
  function enter () {
    return Promise.all([
      // Unload the guest interface
      session.deregister('createAccount'),
      session.deregister('login'),

      user()
    ])
  }

  //
  // The authenticated interface allows users to manage posts and logout
  //
  function user () {
    return Promise.all([
      session.register('createPost', (content) => {
        return Post.create({
          user_id: state.user._id,
          content: content
        })
      }),
      session.register('readMyPosts', () => {
        return Post.find({
          user_id: state.user._id
        })
      }),
      session.register('logout', () => {
        delete state.user
        return exit()
      })
    ])
  }

  //
  // When the user becomes unauthorized, turn off the authorized
  // interface and switch them back to the guest interface
  //
  function exit () {
    return Promise.all([
      // Unload the authenticated interface
      session.deregister('createPost'),
      session.deregister('readMyPosts'),
      session.deregister('logout'),

      guest()
    ])
  }

  return guest()
})

var client = createClient()

var conn = server.createConnection()
client.pipe(conn).pipe(client)

// Use the interface
client
  .then(() => client.remote.createAccount('username', 'password'))
  .then(() => client.remote.createPost('Hello!'))
  .then(() => client.remote.readMyPosts())
  .then(posts => {
    assert(posts[0].content === 'Hello!')
  })
  .then(() => client.remote.logout())
  .then(
    () => console.log('success'),
    e => console.error('boo...', e)
  )
