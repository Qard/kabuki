# kabuki

Kabuki is an RPC interface that layers promise-based, actor-like constructs over a streaming protocol that can be piped anywhere.

## Install

Kabuki 2.x+ requires Node.js 6.x+.

```sh
npm install kabuki
```

## Example

```js
const { createServer, createClient } = require('kabuki')
const assert = require('assert')

// Server has a function to add numbers to an array
let server = createServer(session => {
  let values = []
  return session.register('add', n => {
    values.push(n)
    return session.sum(values).then(sum => ({ values, sum }))
  })
})

// Client has a function to sum values of a list
let client = createClient(session => {
  return session.register('sum', values => {
    return values.reduce((m, v) => m + v, 0)
  })
})

// Pipe streams together
let conn = server.createConnection()
client.pipe(conn).pipe(client)

client
  // When `add` is called, it will add the item to the server-side list
  // and then it will call back to our `sum` function to produce a sum
  .then(() => client.add(2))
  .then(result => {
    assert(result.values.length === 1)
    assert(result.sum === 2)
  })
  // On subsequent calls, the list state will persist and thus grow
  .then(() => client.add(4))
  .then(result => {
    assert(result.values.length === 2)
    assert(result.sum === 6)
    console.log('success')
  })
```

---

### Copyright (c) 2017 Stephen Belanger
#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
