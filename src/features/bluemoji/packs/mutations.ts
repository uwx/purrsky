import {TID} from '@atproto/common-web'
import {type $Typed, type Client} from '@atproto/lex'
import {
  AtUri,
  type NsidString,
  toDatetimeString,
  type UriString,
} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {uploadBlob} from '#/lib/api'
import {useHaptics} from '#/lib/haptics'
import {type PickerImage} from '#/lib/media/picker.shared'
import {logger} from '#/logger'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {aliasToRkey, normalizeAlias} from '#/features/bluemoji/alias'
import {OWN_COLLECTION_ROOT} from '#/features/bluemoji/collection/queries'
import {
  getSafeSourceUrl,
  isCopyableLicense,
} from '#/features/bluemoji/provenance'
import {
  type BluemojiItem,
  parseBluemojiItemRecord,
} from '#/features/bluemoji/util'
import {blue, com} from '#/lexicons'
import {copyBlobToOwnRepo} from './copy-blob'
import {PACK_ITEMS_ROOT, PACK_ROOT, PACKS_ROOT} from './queries'
import {
  type BluemojiPack,
  type BluemojiPackItem,
  getBlobRefs,
  getPackDescriptionError,
  getPackNameError,
  getPackRenditionUrl,
  PACK_COLLECTION,
  PACK_ITEM_COLLECTION,
  packAtUri,
  packRkey,
} from './util'

export const ITEM_COLLECTION: NsidString = 'blue.moji.collection.item'

/**
 * Max records per `com.atproto.repo.applyWrites` request. The PDS refuses very
 * large batches; 50 keeps each request small and gives the progress display
 * something to count in between.
 */
const DELETES_PER_REQUEST = 50

export type PackDraft = {
  name: string
  description?: string
  adultOnly?: boolean
  source?: string
  license?: string
  /** New icon, as returned by the picker. Omitting it keeps the current one. */
  icon?: PickerImage
  /**
   * Icon already uploaded to this repo, used instead of `icon`. A bulk upload
   * points this at the first emoji's rendition, so the pack it creates needs no
   * second upload.
   */
  iconBlob?: blue.moji.packs.pack.Main['icon']
}

export function invalidatePacks(queryClient: QueryClient) {
  void queryClient.invalidateQueries({queryKey: [PACKS_ROOT]})
  void queryClient.invalidateQueries({queryKey: [PACK_ROOT]})
  void queryClient.invalidateQueries({queryKey: [PACK_ITEMS_ROOT]})
}

/**
 * Creates or edits a pack. A new pack gets a TID rkey; an edit keeps its own.
 *
 * Fields we do not edit (`descriptionFacets`, `labels`) are copied from the
 * existing record so a pack another client wrote keeps them instead of losing
 * them to our simpler form.
 */
export async function writePack(
  pds: Client,
  {draft, editing}: {draft: PackDraft; editing?: BluemojiPack},
) {
  const name = draft.name.trim()
  if (getPackNameError(name)) throw new Error('Invalid pack name')
  const description = draft.description?.trim() || undefined
  if (getPackDescriptionError(description ?? ''))
    throw new Error('Invalid pack description')
  const icon =
    draft.iconBlob ??
    (draft.icon
      ? (await uploadBlob(pds, draft.icon.path, draft.icon.mime)).blob
      : editing?.record.icon)
  const previous = editing?.record
  const record: blue.moji.packs.pack.Main = {
    $type: PACK_COLLECTION,
    name,
    description,
    descriptionFacets: previous?.descriptionFacets,
    icon,
    adultOnly: draft.adultOnly || undefined,
    // Only a plain http(s) URL is written: the field is a URI and anything
    // else would either fail the lexicon or render as a dead link.
    source: getSafeSourceUrl(draft.source) as UriString | undefined,
    license: draft.license?.trim() || undefined,
    createdAt: previous?.createdAt ?? toDatetimeString(new Date()),
    labels: previous?.labels,
  }
  const rkey = editing ? packRkey(editing.uri) : TID.nextStr()
  await pds.call(com.atproto.repo.putRecord, {
    repo: pds.assertDid,
    collection: PACK_COLLECTION,
    rkey,
    record,
    // Our PDS does not know this lexicon.
    validate: false,
  })
  return {
    rkey,
    uri: packAtUri(pds.assertDid, rkey),
    created: !editing,
    name,
  }
}

/** One membership record, shared by the pack editor and the bulk upload. */
export async function writePackItem(
  pds: Client,
  packUri: string,
  subject: string,
) {
  await pds.call(com.atproto.repo.putRecord, {
    repo: pds.assertDid,
    collection: PACK_ITEM_COLLECTION,
    rkey: TID.nextStr(),
    record: {
      $type: PACK_ITEM_COLLECTION,
      subject,
      pack: packUri,
      createdAt: new Date().toISOString(),
    },
    validate: false,
  })
}

export function useSavePackMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      draft,
      editing,
    }: {
      draft: PackDraft
      editing?: BluemojiPack
    }) => {
      if (!pds.did) throw new Error('You need to sign in to save a pack')
      return await writePack(pds, {draft, editing})
    },
    onError: (error, {editing}) => {
      logger.error('Failed to save Bluemoji pack', {safeMessage: error})
      Toast.show(
        editing ? l`Could not save your pack` : l`Could not create your pack`,
        {type: 'error'},
      )
    },
    onSuccess: ({created, name}) => {
      haptics.success()
      Toast.show(created ? l`Created ${name}.` : l`Saved ${name}.`)
      invalidatePacks(queryClient)
    },
  })
}

/**
 * Deletes a pack and the membership records that point at it; leaving those
 * behind would keep the emoji in an AppView's view of a pack that no longer
 * exists. The emoji themselves are untouched.
 */
export function useDeletePackMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      pack,
      deleteItems = false,
      onProgress,
    }: {
      pack: BluemojiPack
      /** Also delete the emoji only this pack uses, from the collection. */
      deleteItems?: boolean
      /** Receives how many records have been deleted, and how many there are. */
      onProgress?: (done: number, total: number) => void
    }) => {
      const rkey = packRkey(pack.uri)
      if (!rkey) throw new Error('Not a pack record')
      const memberships = await fetchPackItemRecords(pds)
      const own = memberships.filter(item => item.pack === pack.uri)

      /*
       * All of it goes out as applyWrites batches: one request per chunk of
       * records rather than one per record, which is what made deleting a pack
       * with many emoji slow enough to look stuck. The pack record goes last so
       * that a failure part way through leaves it in place, and the user can
       * retry.
       */
      const writes = own.map(item =>
        deleteWrite(PACK_ITEM_COLLECTION, new AtUri(item.uri).rkey),
      )

      let deletedItems = 0
      let keptItems = 0
      if (deleteItems) {
        /*
         * An emoji another pack also includes stays in the collection: deleting
         * it would empty that pack, which the user did not ask for.
         */
        const shared = new Set(
          memberships
            .filter(item => item.pack !== pack.uri)
            .map(item => item.subject),
        )
        for (const subject of new Set(own.map(item => item.subject))) {
          const uri = toOwnItemUri(subject, pds.assertDid)
          if (!uri || shared.has(subject)) {
            keptItems++
            continue
          }
          writes.push(deleteWrite(ITEM_COLLECTION, uri.rkey))
          deletedItems++
        }
      }

      writes.push(deleteWrite(PACK_COLLECTION, rkey))

      const total = writes.length
      let done = 0
      onProgress?.(done, total)
      for (const batch of chunk(writes, DELETES_PER_REQUEST)) {
        await pds.call(com.atproto.repo.applyWrites, {
          repo: pds.assertDid,
          writes: batch,
        })
        done += batch.length
        onProgress?.(done, total)
      }
      return {name: pack.record.name, deletedItems, keptItems}
    },
    onError: error => {
      logger.error('Failed to delete Bluemoji pack', {safeMessage: error})
      Toast.show(l`Could not delete your pack`, {type: 'error'})
    },
    onSuccess: ({name, deletedItems, keptItems}) => {
      haptics.tap()
      if (!deletedItems) {
        Toast.show(l`Deleted ${name}.`)
      } else {
        Toast.show(
          keptItems
            ? l`Deleted ${name} and ${deletedItems} emoji. ${keptItems} that other packs share stayed in your collection.`
            : l`Deleted ${name} and ${deletedItems} emoji.`,
        )
      }
      if (deletedItems) {
        void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
        void queryClient.invalidateQueries({
          queryKey: ['useBluemojiSearchQuery'],
        })
        void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
      }
      invalidatePacks(queryClient)
    },
  })
}

/** The item a membership points at, when it is one of our own collection items. */
function toOwnItemUri(subject: string, did: string) {
  try {
    const uri = new AtUri(subject)
    if (uri.host !== did || uri.collection !== ITEM_COLLECTION) return null
    return uri
  } catch {
    return null
  }
}

/** A single record deletion for a `com.atproto.repo.applyWrites` batch. */
function deleteWrite(
  collection: NsidString,
  rkey: string,
): $Typed<com.atproto.repo.applyWrites.Delete> {
  return {collection, rkey, $type: 'com.atproto.repo.applyWrites#delete'}
}

/** Every membership record in the repo, with the item each one points at. */
async function fetchPackItemRecords(pds: Client) {
  const records: {uri: string; pack: string; subject: string}[] = []
  let cursor: string | undefined
  do {
    const page = await pds.call(com.atproto.repo.listRecords, {
      repo: pds.assertDid,
      collection: PACK_ITEM_COLLECTION,
      limit: 100,
      cursor,
    })
    for (const record of page.records) {
      const value = blue.moji.packs.packitem.$ifMatches(record.value)
      if (!value) continue
      records.push({
        uri: record.uri,
        pack: value.pack,
        subject: value.subject,
      })
    }
    cursor = page.cursor
  } while (cursor)
  return records
}

/** Adds and removes emoji in one pass. */
export function useSetPackItemsMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      pack,
      add = [],
      remove = [],
      existing: current = [],
    }: {
      pack: BluemojiPack
      add?: BluemojiItem[]
      remove?: BluemojiPackItem[]
      /** Subjects already in the pack, so a re-add does not duplicate them. */
      existing?: string[]
    }) => {
      for (const membership of remove) {
        await pds.call(com.atproto.repo.deleteRecord, {
          repo: pds.assertDid,
          collection: PACK_ITEM_COLLECTION,
          rkey: new AtUri(membership.uri).rkey,
        })
      }
      const existing = new Set(current)
      let added = 0
      for (const item of add) {
        if (existing.has(item.uri)) continue
        existing.add(item.uri)
        await writePackItem(pds, pack.uri, item.uri)
        added++
      }
      return {added, removed: remove.length}
    },
    onError: error => {
      logger.error('Failed to update Bluemoji pack items', {safeMessage: error})
      Toast.show(l`Could not update the pack`, {type: 'error'})
    },
    onSuccess: ({added, removed}) => {
      haptics.confirm()
      if (added && removed) Toast.show(l`Updated the pack.`)
      else if (added) Toast.show(l`Added ${added} emoji.`)
      else if (removed) Toast.show(l`Removed ${removed} emoji.`)
      invalidatePacks(queryClient)
    },
  })
}

/**
 * Copies a pack's emoji into the viewer's own collection.
 *
 * Blobs cannot be referenced across repos, so every rendition is downloaded
 * from the source PDS and uploaded again. Only emoji whose licence permits it
 * are copied, and one already in the collection under the same alias is left
 * alone. `copyOf` keeps a pointer to the original record.
 */
export function useCopyPackToCollectionMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      items,
      onProgress,
    }: {
      items: BluemojiItem[]
      onProgress?: (done: number) => void
    }) => {
      if (!pds.did) throw new Error('You need to sign in to copy emoji')
      const aliases = await fetchOwnAliases(pds)
      let copied = 0
      let skipped = 0
      let unlicensed = 0
      let failed = 0
      for (const [index, item] of items.entries()) {
        // Compared the way `copyItem` writes it, so a copy made from another
        // client (which may store `:name:` unnormalised) still dedupes.
        let name: string
        try {
          name = normalizeAlias(item.record.name)
        } catch {
          // Invalid aliases fail when copied; they are never already present.
          name = item.record.name
        }
        if (!isCopyableLicense(item.record.license)) {
          unlicensed++
        } else if (aliases.has(name)) {
          skipped++
        } else {
          try {
            await copyItem(pds, item)
            aliases.add(name)
            copied++
          } catch (error) {
            logger.error('Failed to copy a Bluemoji', {safeMessage: error})
            failed++
          }
        }
        onProgress?.(index + 1)
      }
      return {copied, skipped, unlicensed, failed}
    },
    onError: error => {
      logger.error('Failed to copy a Bluemoji pack', {safeMessage: error})
      Toast.show(l`Could not copy this pack`, {type: 'error'})
    },
    onSuccess: ({copied, skipped, unlicensed, failed}) => {
      haptics.success()
      const notes = [
        copied ? l`Added ${copied} emoji.` : undefined,
        skipped ? l`${skipped} were already in your collection.` : undefined,
        unlicensed ? l`${unlicensed} do not allow copying.` : undefined,
        failed ? l`${failed} could not be copied.` : undefined,
      ].filter(Boolean)
      Toast.show(notes.length ? notes.join(' ') : l`Nothing to copy.`, {
        type: failed ? 'warning' : undefined,
      })
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      invalidatePacks(queryClient)
    },
  })
}

async function fetchOwnAliases(pds: Client) {
  const aliases = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await pds.call(com.atproto.repo.listRecords, {
      repo: pds.assertDid,
      collection: ITEM_COLLECTION,
      limit: 100,
      cursor,
    })
    for (const record of page.records) {
      const value = parseBluemojiItemRecord(record.value)
      if (!value) continue
      try {
        aliases.add(normalizeAlias(value.name))
      } catch {
        // A record this client cannot name cannot be a copy target either.
      }
    }
    cursor = page.cursor
  } while (cursor)
  return aliases
}

/** Re-uploads every rendition the source record holds, then writes the item. */
async function copyItem(pds: Client, item: BluemojiItem) {
  const refs = getBlobRefs(item.record)
  if (!refs.length) throw new Error('The emoji has no images to copy')
  const pdsUrl = await resolvePdsServiceUrl(item.did)
  if (!pdsUrl) throw new Error('The emoji owner has no PDS')
  const slots: Record<string, unknown> = {}
  for (const ref of refs) {
    const url = getPackRenditionUrl(pdsUrl, item.did, ref.cid)
    slots[ref.slot] = await copyBlobToOwnRepo(pds, url, ref.mimeType)
  }
  const alias = `:${normalizeAlias(item.record.name)}:`
  await pds.call(com.atproto.repo.putRecord, {
    repo: pds.assertDid,
    collection: ITEM_COLLECTION,
    rkey: aliasToRkey(alias),
    record: {
      $type: ITEM_COLLECTION,
      name: alias,
      alt: item.record.alt,
      adultOnly: item.record.adultOnly || undefined,
      labels: item.record.labels,
      copyOf: item.uri,
      source: item.record.source,
      license: item.record.license,
      createdAt: new Date().toISOString(),
      formats: {
        $type: 'blue.moji.collection.item#formats_v1',
        ...slots,
      },
    },
    validate: false,
  })
}
