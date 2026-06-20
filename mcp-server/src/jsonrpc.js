export function makeResponse(id, result) {
  return { jsonrpc: '2.0', id, result }
}

export function makeError(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}

export function encodeMessage(message) {
  const payload = JSON.stringify(message)
  return `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`
}

export function decodeMessage(buffer) {
  const marker = buffer.indexOf('\r\n\r\n')
  if (marker === -1) return null

  const headerText = buffer.subarray(0, marker).toString('utf8')
  const match = headerText.match(/Content-Length:\s*(\d+)/i)
  if (!match) {
    throw new Error(`Missing Content-Length header: ${headerText}`)
  }

  const length = Number(match[1])
  const bodyStart = marker + 4
  if (buffer.length < bodyStart + length) return null

  const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
  return {
    message: JSON.parse(body),
    rest: buffer.subarray(bodyStart + length),
  }
}
