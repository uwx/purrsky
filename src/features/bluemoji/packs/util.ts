import {AtUri} from '@atproto/syntax'
import {countGraphemes} from 'unicode-segmenter/grapheme'

import {BSKY_APP_HOST} from '#/lib/strings/url-helpers'
import {IS_WEB} from '#/env'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {type blue} from '#/lexicons'
import {PACK_COLLECTION, PACK_ITEM_COLLECTION} from './collections'
export {PACK_COLLECTION, PACK_ITEM_COLLECTION}

/** The lexicon caps a pack name at 64 bytes. */
export const PACK_NAME_MAX_BYTES = 64
export const PACK_DESCRIPTION_MAX_GRAPHEMES = 300
export const PACK_DESCRIPTION_MAX_BYTES = 3000

export type BluemojiPack = {
  uri: string
  cid: string
  did: string
  /** Read renditions and icons straight from the owner's PDS. */
  pdsUrl: string
  record: blue.moji.packs.pack.Main
}

export type BluemojiPackItem = {
  uri: string
  /** AT-URI of the emoji this membership points at. */
  subject: string
}

/** A membership read alongside its pack, for filing emoji under a pack. */
export type PackMembership = BluemojiPackItem & {pack: string}

export function packAtUri(did: string, rkey: string) {
  return `at://${did}/${PACK_COLLECTION}/${rkey}`
}

export function packRkey(uri: string) {
  try {
    return new AtUri(uri).rkey
  } catch {
    return ''
  }
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length
}

/** `null` means the name is usable; otherwise it names the broken rule. */
export function getPackNameError(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'empty' as const
  if (byteLength(trimmed) > PACK_NAME_MAX_BYTES) return 'too_long' as const
  return undefined
}

export function getPackDescriptionError(description: string) {
  const trimmed = description.trim()
  if (!trimmed) return undefined
  if (
    countGraphemes(trimmed) > PACK_DESCRIPTION_MAX_GRAPHEMES ||
    byteLength(trimmed) > PACK_DESCRIPTION_MAX_BYTES
  )
    return 'too_long' as const
  return undefined
}

export function packPath(name: string, rkey: string) {
  return `/profile/${name}/emoji-pack/${rkey}`
}

export function packShareUrl(name: string, rkey: string) {
  const origin = IS_WEB ? window.location.origin : BSKY_APP_HOST
  return new URL(packPath(name, rkey), origin).toString()
}

export type PackRef = {name: string; rkey: string}

const RKEY_RE = /^[a-zA-Z0-9._:~-]{1,512}$/

/**
 * Pack links we can render: our own `/profile/<name>/emoji-pack/<rkey>` route,
 * and moji.blue's `/packs/<name>/<rkey>` pages for links written elsewhere.
 */
export function parsePackUrl(url: string): PackRef | undefined {
  let urlp: URL
  try {
    urlp = new URL(url)
  } catch {
    return
  }
  if (urlp.protocol !== 'https:' && urlp.protocol !== 'http:') return
  let parts: string[]
  try {
    parts = urlp.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return
  }
  let ref: PackRef | undefined
  if (
    parts.length === 4 &&
    parts[0] === 'profile' &&
    parts[2] === 'emoji-pack'
  ) {
    ref = {name: parts[1], rkey: parts[3]}
  } else if (
    urlp.hostname === 'moji.blue' &&
    parts.length === 3 &&
    parts[0] === 'packs'
  ) {
    ref = {name: parts[1], rkey: parts[2]}
  }
  if (!ref || !RKEY_RE.test(ref.rkey)) return
  if (!ref.name.startsWith('did:') && !ref.name.includes('.')) return
  return ref
}

export function getPackEmbedRoute(view: {
  uri: string
  associatedRefs?: {uri: string}[]
}): PackRef | undefined {
  const associated = view.associatedRefs?.find(item => {
    try {
      return new AtUri(item.uri).collection === PACK_COLLECTION
    } catch {
      return false
    }
  })
  if (associated) {
    try {
      const uri = new AtUri(associated.uri)
      return {name: uri.hostname, rkey: uri.rkey}
    } catch {}
  }
  return parsePackUrl(view.uri)
}

export function isEmojiPackEmbed(view: {
  uri: string
  associatedRefs?: {uri: string}[]
}) {
  return Boolean(getPackEmbedRoute(view))
}

export function getPackIconUrl(pack: BluemojiPack) {
  const cid = getBlobCid(pack.record.icon)
  if (!cid) return
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pack.pdsUrl)
  url.searchParams.set('did', pack.did)
  url.searchParams.set('cid', cid)
  return url.toString()
}

export function getPackRenditionUrl(pdsUrl: string, did: string, cid: string) {
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid)
  return url.toString()
}

/** Pack item slots that hold a blob, in the order the client prefers them. */
export const PACK_ITEM_BLOB_SLOTS = [
  'webp_128',
  'png_128',
  'gif_128',
  'apng_128',
  'original',
  'webp_512',
  'png_512',
  'gif_512',
  'apng_512',
  'lottie',
] as const

export function getBlobCid(blob: unknown) {
  if (!blob || typeof blob !== 'object' || !('ref' in blob)) return undefined
  const ref = blob.ref
  const cid =
    ref && typeof ref === 'object' && '$link' in ref
      ? String(ref.$link)
      : String(ref)
  return /^[a-zA-Z0-9]+$/.test(cid) ? cid : undefined
}

export function getBlobRefs(record: blue.moji.collection.item.Main) {
  const refs: {slot: string; cid: string; mimeType?: string}[] = []
  const seen = new Set<string>()
  for (const container of [record.formats, record.stickerFormats]) {
    if (!container || typeof container !== 'object') continue
    for (const slot of PACK_ITEM_BLOB_SLOTS) {
      const blob = (container as Record<string, unknown>)[slot]
      const cid = getBlobCid(blob)
      if (!cid || seen.has(slot)) continue
      seen.add(slot)
      const mimeType =
        blob && typeof blob === 'object' && 'mimeType' in blob
          ? String(blob.mimeType)
          : undefined
      refs.push({slot, cid, mimeType})
    }
  }
  return refs
}

/** One labelled block of the picker: a pack's emoji, or what is left over. */
export type EmojiPackSection = {
  /** Absent for emoji that are in no pack. */
  pack?: BluemojiPack
  items: BluemojiItem[]
}

/**
 * Files each emoji under the first pack that lists it, in pack order, keeping
 * the collection's own order inside a section. An emoji can sit in several
 * packs; showing it once keeps the grid scannable. Emoji in no pack come back
 * as a final unlabelled section, so nothing is hidden.
 */
export function groupItemsByPack(
  items: BluemojiItem[],
  packs: BluemojiPack[],
  memberships: PackMembership[],
): EmojiPackSection[] {
  const rank = new Map(packs.map((pack, index) => [pack.uri, index]))
  const filedUnder = new Map<string, number>()
  for (const membership of memberships) {
    const index = rank.get(membership.pack)
    if (index === undefined) continue
    const current = filedUnder.get(membership.subject)
    if (current === undefined || index < current) {
      filedUnder.set(membership.subject, index)
    }
  }

  const sections: EmojiPackSection[] = packs.map(pack => ({
    pack,
    items: [],
  }))
  const loose: BluemojiItem[] = []
  for (const item of items) {
    const index = filedUnder.get(item.uri)
    if (index === undefined) loose.push(item)
    else sections[index].items.push(item)
  }

  const result = sections.filter(section => section.items.length > 0)
  if (loose.length) result.push({items: loose})
  return result
}
