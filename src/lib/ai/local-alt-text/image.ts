import {SaveFormat} from 'expo-image-manipulator'
import {decode} from 'jpeg-js'

import {renderImage} from '#/lib/media/image-manipulator'

/**
 * Longest edge fed to the model. The native preprocessor letterboxes to
 * 512x512 and the web image processor tiles at 512, so larger input is
 * discarded anyway.
 */
const MAX_EDGE = 512

export type ModelImage = {
  /** RGBA pixels, height-major, 4 bytes per pixel. */
  data: Uint8Array
  width: number
  height: number
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Decodes base64 without `atob` or `Buffer`, neither of which can be assumed on
 * every runtime this file is bundled for.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let offset = 0

  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_ALPHABET.indexOf(clean[i])
    if (value < 0) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[offset++] = (buffer >> bits) & 0xff
    }
  }

  return offset === out.length ? out : out.subarray(0, offset)
}

/**
 * Renders the composer image down to at most {@link MAX_EDGE} on its long edge
 * and decodes it to RGBA for the model. JPEG rather than PNG because the
 * intermediate is throwaway and PNG encoding of a photo is far slower.
 */
export async function loadModelImage(
  uri: string,
  width: number,
  height: number,
): Promise<ModelImage> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height, 1))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const result = await renderImage(
    uri,
    scale < 1
      ? ctx => ctx.resize({width: targetWidth, height: targetHeight})
      : undefined,
    {compress: 0.9, format: SaveFormat.JPEG, base64: true},
  )

  if (!result.base64) {
    throw new Error('Could not read the image')
  }

  const decoded = decode(base64ToBytes(result.base64), {
    useTArray: true,
    formatAsRGBA: true,
  })

  return {data: decoded.data, width: decoded.width, height: decoded.height}
}
