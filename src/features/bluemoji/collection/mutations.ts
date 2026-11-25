import {type Client} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {aliasToRkey, normalizeAlias} from '#/features/bluemoji/alias'
import {type PreparedEmojiImage} from '#/features/bluemoji/collection/prepare'
import {OWN_COLLECTION_ROOT} from '#/features/bluemoji/collection/queries'
import {
  invalidatePacks,
  type PackDraft,
  writePack,
  writePackItem,
} from '#/features/bluemoji/packs/mutations'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {com} from '#/lexicons'

export const ITEM_COLLECTION = 'blue.moji.collection.item'

export type EmojiDraft = {
  /** Raw alias, with or without wrapping colons. */
  alias: string
  alt?: string
  /** New image, as prepared by `prepareEmojiImage`. Omitting it keeps the current one. */
  image?: PreparedEmojiImage
  adultOnly?: boolean
  /**
   * SPDX expression such as `CC-BY-4.0`. Omitting it keeps whatever the edited
   * record carried; an empty string clears it. Absent means "unspecified",
   * which the copy gate reads as "no permission", so this is the only thing
   * that lets anyone else add the emoji to their own collection.
   */
  license?: string
}

function rkeyOf(uri: string) {
  try {
    return new AtUri(uri).rkey
  } catch {
    return ''
  }
}

/** One item write, shared by the single and bulk flows. */
async function putEmoji(
  pds: Client,
  {
    alias,
    alt,
    image,
    adultOnly,
    license,
    editing,
  }: EmojiDraft & {editing?: BluemojiItem},
) {
  const name = `:${normalizeAlias(alias)}:`
  // An edit keeps its existing rkey unless the alias changed; historical items
  // have rkeys unrelated to their alias.
  const previousRkey = editing ? rkeyOf(editing.uri) : ''
  const unchangedAlias = editing?.record.name === name
  // `undefined` means the caller has no licence field (bulk upload), so an edit
  // keeps what the record already says instead of silently dropping it. An
  // empty string is a deliberate clear.
  const nextLicense =
    license === undefined
      ? editing?.record.license || undefined
      : license.trim() || undefined
  const uploaded = image
    ? (await uploadBlob(pds, image.image.path, image.image.mime)).blob
    : undefined
  const still = image?.still
    ? (await uploadBlob(pds, image.still.path, image.still.mime)).blob
    : undefined
  const formats = image
    ? {
        $type: 'blue.moji.collection.item#formats_v1' as const,
        ...(image.rendition === 'png_128'
          ? {png_128: uploaded}
          : {
              // The animated bytes are the rendition readers animate; the still
              // keeps clients that only know `png_128` from showing nothing.
              [image.rendition]: uploaded,
              ...(still ? {png_128: still} : {}),
            }),
      }
    : // Keep the existing renditions; the AppView serves those blobs.
      editing?.record.formats
  if (!formats) throw new Error('An emoji needs an image')
  const rkey = unchangedAlias ? previousRkey : aliasToRkey(alias)
  await pds.call(com.atproto.repo.putRecord, {
    repo: pds.assertDid,
    collection: ITEM_COLLECTION,
    rkey,
    record: {
      $type: ITEM_COLLECTION,
      name,
      alt: alt?.trim() || undefined,
      adultOnly: adultOnly || undefined,
      license: nextLicense,
      createdAt: editing?.record.createdAt ?? new Date().toISOString(),
      formats,
    },
    // Our PDS does not know this lexicon.
    validate: false,
  })
  if (previousRkey && !unchangedAlias) {
    await pds.call(com.atproto.repo.deleteRecord, {
      repo: pds.assertDid,
      collection: ITEM_COLLECTION,
      rkey: previousRkey,
    })
  }
  return {
    name,
    added: !editing,
    uri: `at://${pds.assertDid}/${ITEM_COLLECTION}/${rkey}`,
    /*
     * The blob this call uploaded, not the record's rendition: an edit without
     * a new image has nothing new to use as a pack icon. A pack icon is drawn
     * small and still, so an animated upload lends it its first frame.
     */
    icon: still ?? uploaded,
  }
}

/**
 * Writes a `blue.moji.collection.item`, the same record moji.blue's own upload
 * page creates. The rkey is derived from the alias (RFC 0005), so re-uploading
 * an alias replaces it rather than duplicating.
 *
 * Editing an existing item goes through the same call: pass the item and the
 * write lands on its own rkey. Renaming writes the new rkey and deletes the old
 * one, because other clients address items by alias.
 */
export function useSaveEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (draft: EmojiDraft & {editing?: BluemojiItem}) => {
      if (!pds.did) throw new Error('You need to sign in to save an emoji')
      return await putEmoji(pds, draft)
    },
    onError: (error, {editing}) => {
      logger.error('Failed to save custom emoji', {safeMessage: error})
      Toast.show(
        editing ? l`Could not save your emoji` : l`Could not add your emoji`,
        {type: 'error'},
      )
    },
    onSuccess: ({name, added}) => {
      haptics.success()
      Toast.show(
        added
          ? l`Added ${name}. It may take a moment to appear in Discover.`
          : l`Saved ${name}.`,
      )
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}

/**
 * Deletes an emoji by its record rkey. Posts that use it keep their facet and
 * fall back to the alias text once the source record is gone.
 */
/**
 * Writes many emoji one after another, reporting progress as it goes.
 *
 * Sequential on purpose: each item is a blob upload plus a record write, and a
 * burst of twenty parallel uploads is the easiest way to get rate limited by a
 * PDS. One item failing does not stop the rest; the mismatches (usually a bad
 * alias) come back so the caller can name them.
 *
 * Passing `pack` creates it once the items are written and adds each of them
 * as a membership, so the upload and the grouping happen in one pass. A pack
 * failure is reported separately: the emoji are already saved by then.
 */
export function useBulkEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      drafts,
      pack,
      onProgress,
    }: {
      drafts: EmojiDraft[]
      /** New pack to create and fill with every emoji that was written. */
      pack?: {name: string; description?: string}
      onProgress?: (done: number) => void
    }) => {
      if (!pds.did) throw new Error('You need to sign in to add emoji')
      const failed: string[] = []
      const written: {uri: string; icon: PackDraft['iconBlob']}[] = []
      for (const [i, draft] of drafts.entries()) {
        try {
          written.push(await putEmoji(pds, draft))
        } catch (error) {
          failed.push(draft.alias)
          logger.error('Failed to add a custom emoji in bulk', {
            safeMessage: error,
          })
        }
        onProgress?.(i + 1)
      }
      let packError: string | undefined
      let packUrl: string | undefined
      if (pack && written.length) {
        try {
          const saved = await writePack(pds, {
            draft: {
              name: pack.name,
              description: pack.description,
              // The first emoji that uploaded a blob doubles as the pack icon:
              // it is already in this repo, so the pack needs no upload.
              iconBlob: written.find(item => item.icon)?.icon,
            },
          })
          for (const item of written) {
            await writePackItem(pds, saved.uri, item.uri)
          }
          packUrl = saved.uri
        } catch (error) {
          packError = pack.name
          logger.error('Failed to create a Bluemoji pack in bulk', {
            safeMessage: error,
          })
        }
      }
      return {added: written.length, failed, packError, packUrl}
    },
    onSuccess: ({added, failed, packError, packUrl}) => {
      haptics.success()
      const notes = [
        failed.length
          ? l`Added ${added}. These could not be added: ${failed.join(', ')}`
          : l`Added ${added} emoji.`,
        packUrl ? l`Put them in a new pack.` : undefined,
        packError ? l`The pack ${packError} could not be created.` : undefined,
      ].filter(Boolean)
      Toast.show(notes.join(' '), {
        type: failed.length || packError ? 'warning' : undefined,
      })
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
      if (packUrl) invalidatePacks(queryClient)
    },
  })
}

export function useDeleteEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (item: BluemojiItem) => {
      const rkey = rkeyOf(item.uri)
      if (!rkey) throw new Error('Not a collection item')
      await pds.call(com.atproto.repo.deleteRecord, {
        repo: pds.assertDid,
        collection: ITEM_COLLECTION,
        rkey,
      })
      return rkey
    },
    onError: error => {
      logger.error('Failed to delete custom emoji', {safeMessage: error})
      Toast.show(l`Could not delete your emoji`, {type: 'error'})
    },
    onSuccess: rkey => {
      haptics.tap()
      // Drop it from the grid before the PDS read comes back.
      queryClient.setQueriesData<BluemojiItem[]>(
        {queryKey: [OWN_COLLECTION_ROOT]},
        previous => previous?.filter(item => rkeyOf(item.uri) !== rkey),
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}
