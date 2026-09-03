import { describe, expect, it } from 'vitest'
import { decodeMessage, encodeMessage, makeError, makeResponse } from '../../mcp-server/src/jsonrpc.js'

const buf = (s) => Buffer.from(s, 'utf8')

describe('MCP stdio framing', () => {
  it('encodes one message per line with no header', () => {
    // The regression this guards: LSP-style `Content-Length:` framing, which
    // every real MCP client ignores.
    const wire = encodeMessage(makeResponse(1, { ok: true }))
    expect(wire).toBe('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n')
    expect(wire).not.toMatch(/Content-Length/)
  })

  it('never emits an embedded newline, even when the payload contains one', () => {
    const wire = encodeMessage(makeResponse(1, { text: 'line one\nline two' }))
    expect(wire.slice(0, -1)).not.toContain('\n')
  })

  it('round-trips through decode', () => {
    const msg = { jsonrpc: '2.0', id: 7, method: 'tools/list' }
    const decoded = decodeMessage(buf(encodeMessage(msg)))
    expect(decoded.message).toEqual(msg)
  })

  it('returns null until a full line has arrived', () => {
    expect(decodeMessage(buf('{"jsonrpc":"2.0","id":1'))).toBeNull()
  })

  it('keeps the remainder so a batch is drained one message at a time', () => {
    const wire = encodeMessage({ id: 1 }) + encodeMessage({ id: 2 })
    const first = decodeMessage(buf(wire))
    expect(first.message.id).toBe(1)
    expect(decodeMessage(first.rest).message.id).toBe(2)
  })

  it('reassembles a message split across two stdin chunks', () => {
    const wire = encodeMessage({ jsonrpc: '2.0', id: 3, method: 'ping' })
    const cut = 12
    expect(decodeMessage(buf(wire.slice(0, cut)))).toBeNull()
    expect(decodeMessage(buf(wire)).message.id).toBe(3)
  })

  it('skips blank lines rather than failing to parse them', () => {
    const decoded = decodeMessage(buf('\r\n\n' + encodeMessage({ id: 9 })))
    expect(decoded.message.id).toBe(9)
  })

  it('builds errors with an optional data field', () => {
    expect(makeError(1, -32601, 'nope')).toEqual({
      jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'nope' },
    })
    expect(makeError(1, -32601, 'nope', { x: 1 }).error.data).toEqual({ x: 1 })
  })
})
