// Unguessable public share tokens. 16 chars of base62 ≈ 95 bits of entropy, so
// shares are unlisted-by-default — you can't enumerate other people's links.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function randomSlug(len = 16) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}
