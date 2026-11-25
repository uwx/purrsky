/**
 * Format an animated image file is stored as. The lexicon's `apng_128`,
 * `gif_128` and `webp_128` slots are the only signal that an emoji moves: the
 * record carries no animation flag.
 */
export type AnimatedImageFormat = 'apng' | 'gif' | 'webp'

/**
 * Whether a file carries more than one frame, read from its container.
 *
 * The picker reports an APNG as `image/png`, so the mime type cannot tell an
 * animated file from a still one; the bytes can.
 *
 * `bytes` may be a prefix of the file. Animation markers that appear past the
 * prefix read as still, which is the safe direction: a still is never uploaded
 * to an animated slot.
 */
export function detectAnimatedImage(
  bytes: Uint8Array,
): AnimatedImageFormat | undefined {
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return isApng(bytes) ? 'apng' : undefined
  }
  if (ascii(bytes, 0, 4) === 'GIF8') {
    return gifFrameCount(bytes) > 1 ? 'gif' : undefined
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return isAnimatedWebp(bytes) ? 'webp' : undefined
  }
  return undefined
}

function startsWith(bytes: Uint8Array, offset: number, signature: number[]) {
  if (offset + signature.length > bytes.length) return false
  return signature.every((byte, i) => bytes[offset + i] === byte)
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  if (end > bytes.length) return ''
  let out = ''
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i])
  return out
}

/** `acTL` must precede the first `IDAT`, so the walk stops at the image data. */
function isApng(bytes: Uint8Array) {
  for (let offset = 8; offset + 8 <= bytes.length;) {
    const type = ascii(bytes, offset + 4, offset + 8)
    if (type === 'acTL') return true
    if (type === 'IDAT') return false
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    offset += 12 + length
  }
  return false
}

/**
 * Counts image descriptors, walking the block structure rather than searching
 * for 0x2C bytes, which also occur inside compressed frame data and colour
 * tables.
 */
function gifFrameCount(bytes: Uint8Array) {
  if (bytes.length < 13) return 0
  let offset = 13
  const packed = bytes[10]
  if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1))
  let frames = 0
  while (offset < bytes.length) {
    const block = bytes[offset++]
    if (block === 0x3b) break
    if (block === 0x21) {
      offset = skipSubBlocks(bytes, offset + 1)
    } else if (block === 0x2c) {
      frames++
      if (frames > 1) return frames
      if (offset + 9 > bytes.length) return frames
      const localPacked = bytes[offset + 8]
      // Nine descriptor bytes, then the LZW minimum code size.
      offset += 9
      if (localPacked & 0x80) offset += 3 * (1 << ((localPacked & 0x07) + 1))
      offset = skipSubBlocks(bytes, offset + 1)
    } else {
      break
    }
  }
  return frames
}

function skipSubBlocks(bytes: Uint8Array, offset: number) {
  while (offset < bytes.length) {
    const size = bytes[offset++]
    if (!size) return offset
    offset += size
  }
  return offset
}

/**
 * Only an extended-format WebP can animate. Its flags byte, at offset 20, has
 * the animation bit set; a bare `VP8`/`VP8L` stream is a single frame.
 */
function isAnimatedWebp(bytes: Uint8Array) {
  return bytes.length >= 21 && ascii(bytes, 12, 16) === 'VP8X'
    ? (bytes[20] & 0x02) !== 0
    : false
}
