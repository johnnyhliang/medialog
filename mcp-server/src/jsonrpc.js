// MCP stdio framing: newline-delimited JSON.
//
// This previously used LSP's `Content-Length:` header framing, which is a
// different protocol. The server answered correctly to anything speaking that
// dialect and was silent to every real MCP client — Claude Desktop would
// connect, send a newline-delimited `initialize`, and wait forever.
//
// Per the MCP spec (basic/transports/stdio): each message is a single JSON-RPC
// request, notification or response, delimited by newlines, with no embedded
// newlines. JSON.stringify never emits a raw newline inside a string (it
// escapes them as \n), so a plain append is safe.

export function makeResponse(id, result) {
  return { jsonrpc: '2.0', id, result }
}

export function makeError(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}

export function encodeMessage(message) {
  return `${JSON.stringify(message)}\n`
}

/**
 * Pull one complete message off the front of `buffer`.
 *
 * Returns null when no full line has arrived yet — stdin delivers arbitrary
 * chunks, so a message can straddle two reads and the caller must keep the
 * remainder. Blank lines are skipped rather than treated as parse errors:
 * a stray \r\n or a trailing newline is not a malformed message.
 */
export function decodeMessage(buffer) {
  let rest = buffer
  while (true) {
    const newline = rest.indexOf('\n')
    if (newline === -1) return null

    const line = rest.subarray(0, newline).toString('utf8').trim()
    rest = rest.subarray(newline + 1)

    if (!line) continue // blank line between messages — not an error

    return { message: JSON.parse(line), rest }
  }
}
