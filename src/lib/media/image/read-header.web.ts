/**
 * The first `maxBytes` of an image file, for sniffing its container. A short
 * read is the whole file: the caller can treat its length as the file size.
 */
export async function readImageHeader(
  uri: string,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  try {
    const blob = await fetch(uri).then(r => r.blob())
    return new Uint8Array(await blob.slice(0, maxBytes).arrayBuffer())
  } catch {
    return undefined
  }
}
