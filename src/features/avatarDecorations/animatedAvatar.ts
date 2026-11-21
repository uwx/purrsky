import {type BlobRef, parseCidSafe} from '@atproto/lex'

import {type ImgproxyPreset} from '#/lib/media/util'

/**
 * Image types that can carry animation. APNG has no portable mime type of its
 * own, so a plain `image/png` is accepted as well - a still PNG simply renders
 * as one. Anything else (SVG in particular) is refused: the blob is rendered in
 * an image tag on every viewer's device.
 */
const ANIMATED_AVATAR_MIME_TYPES = [
  'image/apng',
  'image/avif',
  'image/gif',
  'image/png',
  'image/webp',
]

/**
 * An animated avatar loads in every feed row it appears in, so keep it well
 * under the PDS blob limit (5 MB). Uploads are never recompressed: re-encoding
 * would flatten the animation.
 */
export const MAX_ANIMATED_AVATAR_BYTES = 4_000_000

/** A file the owner picked but has not uploaded yet. */
export type AnimatedAvatarPick = {
  mime: string
  path: string
  size: number
  /** Shown next to the pick when the platform reports it. */
  fileName?: string
}

export type AnimatedAvatarRejection = 'type' | 'size'

export function isAnimatedAvatarMime(mime: string | undefined) {
  return !!mime && ANIMATED_AVATAR_MIME_TYPES.includes(mime.toLowerCase())
}

/** Rejects a file before it is uploaded, so the record never names bytes we cannot render. */
export function checkAnimatedAvatar({
  mime,
  size,
}: {
  mime?: string
  size?: number
}): {ok: true} | {ok: false; reason: AnimatedAvatarRejection} {
  if (!isAnimatedAvatarMime(mime)) return {ok: false, reason: 'type'}
  // Callers pass an estimate when the picker does not report a byte count.
  if ((size ?? 0) > MAX_ANIMATED_AVATAR_BYTES) return {ok: false, reason: 'size'}
  return {ok: true}
}

/**
 * Reads a blob out of a record in either form it arrives in: the lex client
 * returns lex values, while a raw fetch (Slingshot) returns JSON with a `$link`
 * reference. Rebuilds the lex form so a later write serializes the reference as
 * a link rather than as a map.
 */
export function parseAnimatedAvatarBlob(value: unknown): BlobRef | undefined {
  if (!value || typeof value !== 'object' || !('ref' in value)) return undefined
  const rawMime = 'mimeType' in value ? value.mimeType : undefined
  const mime = typeof rawMime === 'string' ? rawMime : undefined
  if (!isAnimatedAvatarMime(mime)) return undefined
  const rawSize = 'size' in value ? value.size : undefined
  const size = typeof rawSize === 'number' && rawSize >= 0 ? rawSize : 0
  if (size > MAX_ANIMATED_AVATAR_BYTES) return undefined
  const cid = parseBlobCid(value.ref)
  if (!cid) return undefined
  return {$type: 'blob', ref: cid, mimeType: mime as string, size}
}

function parseBlobCid(ref: unknown) {
  if (typeof ref === 'string') return parseCidSafe(ref)
  if (!ref || typeof ref !== 'object') return undefined
  if ('$link' in ref && typeof ref.$link === 'string') {
    return parseCidSafe(ref.$link)
  }
  // A lex BlobRef holds a CID object whose string form is the CID itself.
  const stringify = (ref as {toString?: () => string}).toString
  if (typeof stringify === 'function' && stringify !== Object.prototype.toString) {
    return parseCidSafe(stringify.call(ref))
  }
  return undefined
}

/** CID of a stored blob, or undefined. */
export function avatarBlobCid(blob: BlobRef | undefined): string | undefined {
  if (!blob) return undefined
  return parseBlobCid('$type' in blob ? blob.ref : blob.cid)?.toString()
}

/**
 * A still rendition of the blob. The image CDN re-encodes every image it serves
 * and never passes animation through, so this is the first frame - which is
 * exactly what a viewer who cannot see motion should get.
 */
export function avatarBlobStillUrl(
  did: string,
  cid: string,
  preset: ImgproxyPreset,
): string {
  // `@png` keeps transparency, which animated stickers rely on.
  return `https://cdn.bsky.app/img/${preset}/plain/${did}/${cid}@png`
}

/**
 * The original blob bytes. The image CDN re-encodes every rendition, so
 * animation has to come straight from the owner's PDS.
 */
export function animatedAvatarPlayUrl(
  pdsUrl: string | undefined,
  did: string,
  cid: string,
): string | undefined {
  if (!pdsUrl) return undefined
  try {
    const url = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
    url.searchParams.set('did', did)
    url.searchParams.set('cid', cid)
    return url.toString()
  } catch {
    return undefined
  }
}
