const msgpack = require('msgpack5')

module.exports = {
  encode() {
    return msgpack().encoder()
  },

  decode() {
    return msgpack().decoder()
  }
}
