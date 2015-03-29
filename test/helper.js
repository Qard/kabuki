import through2 from 'through2'
import duplexer from 'duplexer'
import msgpack from 'msgpack'

export function encode () {
  let stream = through2(function (data, _, done) {
    this.push(msgpack.pack(data))
    return done()
  })
  stream._writableState.objectMode = true
  return stream
}

export function decode () {
  let input = through2()
  let output = through2.obj()
  let ms = new msgpack.Stream(input)
  ms.addListener('msg', output.write.bind(output))
  return duplexer(input, output)
}
