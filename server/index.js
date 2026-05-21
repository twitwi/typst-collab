import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { WebSocketServer } = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')

const port = process.env.PORT || 4000
const wss = new WebSocketServer({ port })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

console.log(`y-websocket server running on ws://localhost:${port}`)
