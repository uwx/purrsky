import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {
  AtUri,
  type NsidString,
  toDatetimeString,
  type UriString,
} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

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
  packRkey,
} from './util'

export const ITEM_COLLECTION: NsidString = 'blue.moji.collection.item'

export type PackDraft = {
  name: string
  description?: string
  adultOnly?: boolean
  source?: string
  license?: string
  /** New icon, as returned by the picker. Omitting it keeps the current one. */
  icon?: PickerImage
}

function invalidatePacks(queryClient: ReturnType<typeof useQueryClient>) {
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
      const name = draft.name.trim()
      if (getPackNameError(name)) throw new Error('Invalid pack name')
      const description = draft.description?.trim() || undefined
      if (getPackDescriptionError(description ?? ''))
        throw new Error('Invalid pack description')
      const icon = draft.icon
        ? (await uploadBlob(pds, draft.icon.path, draft.icon.mime)).blob
        : editing?.record.icon
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
      return {rkey, created: !editing, name}
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
    mutationFn: async (pack: BluemojiPack) => {
      const rkey = packRkey(pack.uri)
      if (!rkey) throw new Error('Not a pack record')
      for (const item of await fetchPackItemUris(pds, pack.uri)) {
        await pds.call(com.atproto.repo.deleteRecord, {
          repo: pds.assertDid,
          collection: PACK_ITEM_COLLECTION,
          rkey: new AtUri(item).rkey,
        })
      }
      await pds.call(com.atproto.repo.deleteRecord, {
        repo: pds.assertDid,
        collection: PACK_COLLECTION,
        rkey,
      })
      return pack.record.name
    },
    onError: error => {
      logger.error('Failed to delete Bluemoji pack', {safeMessage: error})
      Toast.show(l`Could not delete your pack`, {type: 'error'})
    },
    onSuccess: name => {
      haptics.tap()
      Toast.show(l`Deleted ${name}.`)
      invalidatePacks(queryClient)
    },
  })
}

async function fetchPackItemUris(pds: Client, packUri: string) {
  const uris: string[] = []
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
      if (!value || value.pack !== packUri) continue
      uris.push(record.uri)
    }
    cursor = page.cursor
  } while (cursor)
  return uris
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
        await pds.call(com.atproto.repo.putRecord, {
          repo: pds.assertDid,
          collection: PACK_ITEM_COLLECTION,
          rkey: TID.nextStr(),
          record: {
            $type: PACK_ITEM_COLLECTION,
            subject: item.uri,
            pack: pack.uri,
            createdAt: new Date().toISOString(),
          },
          validate: false,
        })
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
