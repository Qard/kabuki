import Connection from './connection'
import Server from './server'
import Client from './client'

export { Connection, Server, Client }

export function createServer (handler) {
  return new Server(handler)
}

export function createClient (handler) {
  return new Client(handler)
}

export function createConnection (handler) {
  return new Connection(handler)
}
