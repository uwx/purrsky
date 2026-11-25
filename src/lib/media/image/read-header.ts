import {File} from 'expo-file-system'

/**
 * The first `maxBytes` of an image file, for sniffing its container. A short
 * read is the whole file: the caller can treat its length as the file size.
 */
export async function readImageHeader(
  uri: string,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  try {
    const file = new File(uri.startsWith('/') ? `file://${uri}` : uri)
    const handle = file.open()
    try {
      return await handle.readBytes(Math.min(maxBytes, file.size))
    } finally {
      handle.close()
    }
  } catch {
    return undefined
  }
}
