import { createSupabaseClient } from './config.js'
import { createRouter } from './router.js'
import { decodeMessage, encodeMessage, makeError, makeResponse } from './jsonrpc.js'

const NAME = 'medialog-mcp-server'
const VERSION = '0.2.0'

export function createMcpServer(env = process.env) {
  const supabase = createSupabaseClient(env)
  const router = createRouter(supabase)

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
    process.stdin.on('data', async (chunk) => {
      inputBuffer = Buffer.concat([inputBuffer, chunk])
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
    })

    process.stdin.on('end', () => {
      process.exit(0)
    })

    process.on('uncaughtException', (error) => {
      send(makeError(null, -32603, error.message))
      process.exit(1)
    })
  }

  return { start }
}
