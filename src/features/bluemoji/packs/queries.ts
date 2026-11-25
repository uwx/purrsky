import {Client} from '@atproto/lex'
import {type DidString, type NsidString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {STALE} from '#/state/queries'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {fetchBluemojiItem} from '#/features/bluemoji/queries'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {blue, com} from '#/lexicons'
import {
  type BluemojiPack,
  type BluemojiPackItem,
  PACK_COLLECTION,
  PACK_ITEM_COLLECTION,
  packAtUri,
  type PackMembership,
} from './util'

export const PACKS_ROOT = 'useEmojiPacksQuery'
export const PACK_ROOT = 'useEmojiPackQuery'
export const PACK_ITEMS_ROOT = 'useEmojiPackItemsQuery'

/** Caps a pack so a pathological repo cannot stall the screen. */
const MAX_RECORDS = 1000

type RepoRecord = {
  uri: string
  cid?: string
  value: unknown
}

async function connect(did: string) {
  const pdsUrl = await resolvePdsServiceUrl(did as DidString)
  if (!pdsUrl || !pdsUrl.startsWith('https://')) return
  return {pdsUrl, client: new Client(pdsUrl)}
}

async function listAll(
  client: Client,
  repo: string,
  collection: NsidString,
  {reverse}: {reverse?: boolean} = {},
) {
  const records: RepoRecord[] = []
  let cursor: string | undefined
  do {
    const page = await client.call(com.atproto.repo.listRecords, {
      repo: repo as DidString,
      collection,
      limit: 100,
      reverse,
      cursor,
    })
    for (const record of page.records) {
      records.push({uri: record.uri, cid: record.cid, value: record.value})
    }
    cursor = page.cursor
  } while (cursor && records.length < MAX_RECORDS)
  return records
}

/**
 * Reads a pack straight from its owner's PDS.
 *
 * There is no AppView index we can rely on for packs, and the PDS is
 * authoritative for the records anyway, so every read works this way.
 */
export async function fetchPack(
  did: string,
  rkey: string,
): Promise<BluemojiPack | null> {
  const connection = await connect(did)
  if (!connection) return null
  try {
    const result = await connection.client.call(com.atproto.repo.getRecord, {
      repo: did as DidString,
      collection: PACK_COLLECTION,
      rkey,
    })
    const record = blue.moji.packs.pack.$ifMatches(result.value)
    if (!record || !result.cid) return null
    if (result.uri !== packAtUri(did, rkey)) return null
    return {
      uri: result.uri,
      cid: result.cid,
      did,
      pdsUrl: connection.pdsUrl,
      record,
    }
  } catch {
    return null
  }
}

/** Membership records are filtered client-side; the PDS has no query API. */
export async function fetchPackItems(
  pack: BluemojiPack,
): Promise<BluemojiPackItem[]> {
  const records = await listAll(
    new Client(pack.pdsUrl),
    pack.did,
    PACK_ITEM_COLLECTION,
  )
  const items: BluemojiPackItem[] = []
  for (const record of records) {
    const value = blue.moji.packs.packitem.$ifMatches(record.value)
    if (!value || value.pack !== pack.uri) continue
    items.push({uri: record.uri, subject: value.subject})
  }
  return items
}

/** Resolves membership records into the emoji records they point at. */
export async function fetchPackContents(pack: BluemojiPack) {
  const memberships = await fetchPackItems(pack)
  const subjects = [...new Set(memberships.map(item => item.subject))]
  const items = await mapLimit(subjects, 6, async subject => {
    try {
      return await fetchBluemojiItem(subject)
    } catch {
      // A dangling subject (deleted, or an unreachable PDS) is not fatal.
      return null
    }
  })
  return {
    memberships,
    items: items.filter((item): item is BluemojiItem => Boolean(item)),
  }
}

export async function fetchPacks(did: string) {
  const connection = await connect(did)
  if (!connection) {
    return {
      packs: [],
      counts: {} as Record<string, number>,
      memberships: [] as PackMembership[],
    }
  }
  const {client, pdsUrl} = connection
  const packs: BluemojiPack[] = []
  for (const record of await listAll(client, did, PACK_COLLECTION, {
    reverse: true,
  })) {
    const value = blue.moji.packs.pack.$ifMatches(record.value)
    if (!value || !record.cid) continue
    packs.push({
      uri: record.uri,
      cid: record.cid,
      did,
      pdsUrl,
      record: value,
    })
  }

  const counts: Record<string, number> = {}
  const memberships: PackMembership[] = []
  const packUris: Record<string, true> = {}
  for (const pack of packs) packUris[pack.uri] = true
  try {
    for (const record of await listAll(client, did, PACK_ITEM_COLLECTION)) {
      const value = blue.moji.packs.packitem.$ifMatches(record.value)
      if (!value || !packUris[value.pack]) continue
      counts[value.pack] = (counts[value.pack] ?? 0) + 1
      memberships.push({
        uri: record.uri,
        subject: value.subject,
        pack: value.pack,
      })
    }
  } catch {
    // The pack list itself already loaded; counts and grouping are decoration.
  }
  return {packs, counts, memberships}
}

export function usePackQuery({
  did,
  rkey,
  enabled = true,
}: {
  did?: string
  rkey: string
  enabled?: boolean
}) {
  const deferred = useDeferredEnable(Boolean(did))
  return useQuery({
    queryKey: createQueryKey(PACK_ROOT, {did, rkey}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && deferred && Boolean(did),
    retry: false,
    queryFn: () => (did ? fetchPack(did, rkey) : Promise.resolve(null)),
  })
}

export function usePacksQuery({
  did,
  enabled = true,
}: {
  did?: string
  enabled?: boolean
}) {
  const deferred = useDeferredEnable(Boolean(did))
  return useQuery({
    queryKey: createQueryKey(PACKS_ROOT, {did}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && deferred && Boolean(did),
    retry: false,
    queryFn: () =>
      did
        ? fetchPacks(did)
        : Promise.resolve({packs: [], counts: {}, memberships: []}),
  })
}

export function useOwnPacksQuery({enabled = true}: {enabled?: boolean} = {}) {
  const {currentAccount} = useSession()
  return usePacksQuery({
    did: currentAccount?.did,
    enabled: enabled && Boolean(currentAccount),
  })
}

export function usePackContentsQuery(
  pack: BluemojiPack | null | undefined,
  {enabled = true}: {enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: createQueryKey(PACK_ITEMS_ROOT, {uri: pack?.uri}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && Boolean(pack),
    retry: false,
    queryFn: () => (pack ? fetchPackContents(pack) : Promise.resolve(null)),
  })
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  const workers = Array.from(
    {length: Math.min(limit, values.length)},
    async () => {
      while (next < values.length) {
        const index = next++
        results[index] = await fn(values[index])
      }
    },
  )
  await Promise.all(workers)
  return results
}
