import { createSupabaseClient, loadUserId } from './config.js'
import { createRouter } from './router.js'
import { decodeMessage, encodeMessage, makeError, makeResponse } from './jsonrpc.js'

const NAME = 'medialog-mcp-server'
const VERSION = '0.2.0'

export function createMcpServer(env = process.env) {
  const supabase = createSupabaseClient(env)
  const router = createRouter(supabase, { userId: loadUserId(env) })

  let inputBuffer = Buffer.alloc(0)

  function send(message) {
    process.stdout.write(encodeMessage(message))
  }

  async function handle(message) {
    if (!message || typeof message !== 'object') return

    if (message.method === 'initialize') {
      send(makeResponse(message.id, {
        protocolVersion: message.params?.protocolVersion || '2024-11-05',
        serverInfo: { name: NAME, version: VERSION },
        capabilities: { tools: { listChanged: false } },
      }))
      return
    }

    if (message.method === 'notifications/initialized') {
      return
    }

    if (message.method === 'tools/list') {
      send(makeResponse(message.id, { tools: router.tools }))
      return
    }

    if (message.method === 'tools/call') {
      try {
        const result = await router.call(message.params?.name, message.params?.arguments ?? {})
        send(makeResponse(message.id, result))
      } catch (error) {
        send(makeResponse(message.id, {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
          }],
          isError: true,
        }))
      }
      return
    }

    send(makeError(message.id ?? null, -32601, `Method not found: ${message.method}`))
  }

  function start() {
    // Requests are async (every tool hits the network) and must be answered in
    // order, so reading and handling are separated: stdin only appends to the
    // buffer, and a single drain loop owns decoding and dispatch. Without that
    // guard two overlapping 'data' events interleave their awaits and replies
    // come back out of order.
    //
    // stdin closing means the client has stopped sending, NOT that outstanding
    // work may be abandoned. A bare process.exit(0) on 'end' drops both replies
    // still in flight and messages still queued in the buffer — silent loss
    // from the caller's side. Exit only once the queue is empty and the loop is
    // idle.
    let draining = false
    let inputEnded = false

    function exitIfFinished() {
      if (!inputEnded || draining) return
      // A complete message may still be sitting unparsed in the buffer.
      let remaining = false
      try {
        remaining = decodeMessage(inputBuffer) !== null
      } catch {
        remaining = false
      }
      if (!remaining) process.exit(0)
    }

    async function drain() {
      if (draining) return
      draining = true
      try {
        while (true) {
          let decoded
          try {
            decoded = decodeMessage(inputBuffer)
          } catch (error) {
            send(makeError(null, -32700, error instanceof Error ? error.message : String(error)))
            inputBuffer = Buffer.alloc(0)
            return
          }
          if (!decoded) return
          inputBuffer = decoded.rest
          try {
            await handle(decoded.message)
          } catch (error) {
            send(makeResponse(decoded.message.id ?? null, {
              content: [{
                type: 'text',
                text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
              }],
              isError: true,
            }))
          }
        }
      } finally {
        draining = false
        exitIfFinished()
      }
    }

    process.stdin.on('data', (chunk) => {
      inputBuffer = Buffer.concat([inputBuffer, chunk])
      drain()
    })

    process.stdin.on('end', () => {
      inputEnded = true
      exitIfFinished()
    })

    // Staying alive is the whole point of these two handlers.
    //
    // Exiting here killed the server for the rest of the session: the client
    // spawns it once and talks over pipes, so a single unhandled error in one
    // tool call took every later call down with it and the user saw an
    // assistant that had silently lost its tools. Nothing here holds
    // per-request state worth abandoning — a Supabase client and an input
    // buffer — so failing the request and continuing to serve is both safe and
    // what the caller needs.
    //
    // stderr, never stdout: stdout carries the JSON-RPC stream and anything
    // else written there corrupts the message framing.
    process.on('uncaughtException', (error) => {
      process.stderr.write(`[medialog-mcp] uncaught: ${error?.stack || error}
`)
      send(makeError(null, -32603, `internal error: ${error?.message ?? String(error)}`))
    })

    // Node terminates on an unhandled rejection by default, which is the same
    // session-ending failure by another route — and every tool here is async,
    // so this is the likelier of the two.
    process.on('unhandledRejection', (reason) => {
      process.stderr.write(`[medialog-mcp] unhandled rejection: ${reason?.stack || reason}
`)
      send(makeError(null, -32603, `internal error: ${reason?.message ?? String(reason)}`))
    })
  }

  return { start }
}
