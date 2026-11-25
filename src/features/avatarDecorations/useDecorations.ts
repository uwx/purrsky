import {type TextStyle} from 'react-native'
import {type BlobRef, type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {type ImgproxyPreset} from '#/lib/media/util'
import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {useA11y} from '#/state/a11y'
import {
  useDisableCustomNameStyles,
  useDisableProfileThemes,
  useShowNameOutlines,
} from '#/state/preferences'
import {
  maybeModifyImageCdnHost,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useSlingshotInstance} from '#/state/preferences/slingshot-instance'
import {STALE} from '#/state/queries'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, usePdsServiceUrl, useSession} from '#/state/session'
import {com} from '#/lexicons'
import {
  animatedAvatarPlayUrl,
  avatarBlobCid,
  avatarBlobStillUrl,
} from './animatedAvatar'
import {type DecorationFrame, resolveFrame} from './catalog'
import {type DecorationDraft, draftToPatch, resolveDraft} from './draft'
import {useNameFontAlias} from './nameFonts'
import {type NameGradientSpec} from './nameGradients'
import {nameGradientTextStyle} from './nameGradientStyle'
import {resolveNamePaint} from './namePaint'
import {
  buildDecorationRecord,
  type DecorationSettings,
  getDecorationSettings,
  parseDecorationSettings,
  type ProfileThemeRef,
  SETTINGS_COLLECTION,
  SETTINGS_RKEY,
} from './records'

const activeDecorationsQueryRoot = 'activeDecorations'

/**
 * The settings record for `did`. Every slot hook below shares this query, so
 * React Query dedupes a DID to one resolution per staleTime no matter how many
 * avatars and names reference it.
 */
function useActiveDecorations(did: string | undefined) {
  const slingshot = useSlingshotInstance()
  // Decoration checks run for every author in a feed, so keep them off the
  // cold render and scroll path like the other fork-specific lookups.
  const enabled = useDeferredEnable(!!did)
  const {data} = useQuery({
    queryKey: createQueryKey(activeDecorationsQueryRoot, {did, slingshot}),
    enabled,
    staleTime: STALE.MINUTES.THIRTY,
    queryFn: () => getDecorationSettings(did!, slingshot),
  })
  return data
}

/**
 * The paint a DID's display name needs, honouring the viewer's display
 * options, or undefined when the name should render plainly.
 */
function useResolvedNamePaint(did: string | undefined) {
  const active = useActiveDecorations(did)
  const forceOutline = useShowNameOutlines()
  const customDisabled = useDisableCustomNameStyles()
  return resolveNamePaint(active, {forceOutline, customDisabled})
}

/**
 * Active avatar frame for a DID, or undefined. A record can name a color
 * without a curated frame, which renders as a plain ring in that color.
 */
export function useAvatarDecoration(
  did: string | undefined,
): DecorationFrame | undefined {
  const active = useActiveDecorations(did)
  return resolveFrame(active?.avatar, active?.avatarColor)
}

/** Active avatar shape for a DID, or undefined when the viewer default applies. */
export function useAvatarShape(did: string | undefined) {
  return useActiveDecorations(did)?.avatarShape
}

/**
 * The published theme `did` points their profile at, or undefined when they
 * have none or the viewer asked to ignore profile themes. The theme itself is
 * fetched by the caller: this only resolves the pointer.
 */
export function useProfileThemeRef(
  did: string | undefined,
  enabled = true,
): ProfileThemeRef | undefined {
  const active = useActiveDecorations(did)
  const disabled = useDisableProfileThemes()
  if (!enabled || disabled) return undefined
  return active?.profileTheme
}

const avatarPdsQueryRoot = 'avatarPdsService'

/**
 * The PDS origin for `did`, needed to read blob bytes. Only resolved on demand:
 * a profile's own PDS is already known, and a viewer who cannot see motion
 * never needs anyone else's.
 */
function useAvatarPdsUrl(did: string | undefined, enabled: boolean) {
  const {currentAccount} = useSession()
  const ownPds = usePdsServiceUrl()
  const isOwn = !!did && did === currentAccount?.did
  const deferred = useDeferredEnable(!!did && enabled && !isOwn)
  const {data} = useQuery({
    queryKey: createQueryKey(avatarPdsQueryRoot, {did}),
    enabled: deferred,
    staleTime: STALE.HOURS.ONE,
    queryFn: () => resolvePdsServiceUrl(did as DidString),
  })
  return isOwn ? ownPds : data
}

/**
 * An animated avatar a viewer may play, plus a still for when they should not.
 * `playUri` stays undefined until the owner's PDS is known and is always
 * undefined when the platform reports reduced motion.
 */
export type AnimatedAvatarSource = {
  /** Original blob bytes; only set when motion is allowed. */
  playUri?: string
  /** First frame from the image CDN, safe to render anywhere. */
  stillUri: string
  /** The blob the source renders, so a failure stays attached to it. */
  cid: string
}

/**
 * Resolves an animated avatar blob into the URLs a renderer needs. `did` owns
 * the blob, so its PDS serves the bytes. Motion is off (and no PDS lookup
 * happens) when the platform reports reduced motion.
 */
export function useAnimatedAvatarBlob(
  did: string | undefined,
  blob: BlobRef | undefined,
  preset: ImgproxyPreset = 'avatar',
  /**
   * False when this renderer cannot show motion (a polygon clip, a tiny
   * avatar), so no PDS lookup is made for bytes that would never play.
   */
  playable = true,
): AnimatedAvatarSource | undefined {
  const cid = avatarBlobCid(blob)
  const imageCdnHost = useImageCdnHost()
  const reduceMotion = useA11y().reduceMotionEnabled
  const play = playable && !reduceMotion
  const pdsUrl = useAvatarPdsUrl(did, !!cid && play)

  if (!did || !cid) return undefined
  return {
    ...(play ? {playUri: animatedAvatarPlayUrl(pdsUrl, did, cid)} : {}),
    // The still stays a PNG: converting it to the viewer's thumbnail format
    // would drop the transparency animated stickers depend on.
    stillUri: maybeModifyImageCdnHost(
      avatarBlobStillUrl(did, cid, preset),
      imageCdnHost,
    ),
    cid,
  }
}

/**
 * Resolves the animated avatar `did` stores in their decorations record, or
 * undefined when they have none.
 */
export function useAnimatedAvatar(
  did: string | undefined,
  preset: ImgproxyPreset = 'avatar',
  playable = true,
): AnimatedAvatarSource | undefined {
  const active = useActiveDecorations(did)
  return useAnimatedAvatarBlob(did, active?.avatarAnimated, preset, playable)
}

/** Active display-name gradient for a DID, or undefined. */
export function useNameGradient(
  did: string | undefined,
): NameGradientSpec | undefined {
  return useResolvedNamePaint(did)?.gradient
}

/**
 * Computed text style for a DID's display name (paint, outline, and font), or
 * undefined. Spread into a name's style array at the call site so the whole
 * decoration resolves in one place.
 *
 * The font alias stays undefined until the face has loaded, so a name renders
 * in the app font rather than flashing a fallback.
 */
export function useNameStyle(did: string | undefined): TextStyle | undefined {
  const paint = useResolvedNamePaint(did)
  const fontAlias = useNameFontAlias(paint?.font)
  if (!paint) return undefined

  const style: {-readonly [K in keyof TextStyle]: TextStyle[K]} = {}
  if (paint.gradient) {
    Object.assign(
      style,
      nameGradientTextStyle(paint.gradient, {outline: paint.outline}),
    )
  } else if (paint.color) {
    // A flat fill narrows to a one-stop gradient so the edge is drawn by the
    // same code path as a gradient name.
    Object.assign(
      style,
      nameGradientTextStyle(
        {colors: [paint.color], solid: paint.color},
        {outline: paint.outline},
      ),
    )
  }
  if (fontAlias) style.fontFamily = fontAlias
  return style
}

const myDecorationSettingsQueryRoot = 'myDecorationSettings'

/** Read straight from the PDS so saving never merges an indexer's stale copy. */
async function readOwnSettings(client: Client, did: DidString) {
  try {
    return await client.call(com.atproto.repo.getRecord, {
      repo: did,
      collection: SETTINGS_COLLECTION,
      rkey: SETTINGS_RKEY,
    })
  } catch (error) {
    if (isRecordNotFoundError(error)) return undefined
    throw error
  }
}

/**
 * The current account's own settings, read straight from the PDS so the
 * settings screen can preview choices. Empty until loaded.
 */
export function useMyDecorationSettingsQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  return useQuery({
    queryKey: createQueryKey(myDecorationSettingsQueryRoot, {did}),
    enabled: !!did,
    staleTime: STALE.MINUTES.ONE,
    queryFn: async () => {
      const result = await readOwnSettings(client, did!)
      return parseDecorationSettings(result?.value)
    },
  })
}

export function useMyDecorationSettings(): DecorationSettings {
  return useMyDecorationSettingsQuery().data ?? {}
}

/**
 * Writes the current account's settings record, merging `patch` over whatever
 * is already stored (putRecord replaces the whole record, so this is a
 * read-modify-write). Pass a slot as undefined to clear it.
 */
/**
 * Saves a decorations draft. A picked animation is uploaded first, because the
 * record can only name bytes that already exist; every other slot is written
 * from the draft as-is.
 */
export function useSaveDecorations() {
  const client = usePdsClient()
  const setDecorations = useSetDecorations()

  return useMutation({
    async mutationFn({
      draft,
      saved,
    }: {
      draft: DecorationDraft
      saved: DecorationSettings
    }) {
      const patch = draftToPatch(draft, saved)
      const pick = resolveDraft(draft, saved).animatedPick
      if (pick) {
        const {blob} = await uploadBlob(client, pick.path, pick.mime)
        patch.avatarAnimated = blob
      }
      return await setDecorations.mutateAsync(patch)
    },
  })
}

export function useSetDecorations() {
  const client = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const slingshot = useSlingshotInstance()
  const did = currentAccount?.did

  return useMutation({
    scope: {id: `decorations:${did}`},
    async mutationFn(patch: Partial<DecorationSettings>) {
      if (!did) throw new Error('User not logged in')
      const repo = did
      const current = await readOwnSettings(client, repo)
      const record = buildDecorationRecord(
        parseDecorationSettings(current?.value),
        patch,
      )
      await client.call(com.atproto.repo.putRecord, {
        repo,
        collection: SETTINGS_COLLECTION,
        rkey: SETTINGS_RKEY,
        swapRecord: current?.cid ?? null,
        record,
        // Not an app.bsky collection, so the PDS has no schema for it.
        validate: false,
      })
      return {
        did: repo,
        next: parseDecorationSettings(record),
        slingshot,
      }
    },
    onSuccess({did: savedDid, next, slingshot: savedSlingshot}) {
      queryClient.setQueryData(
        createQueryKey(myDecorationSettingsQueryRoot, {did: savedDid}),
        next,
      )
      // Keep our own preview current without waiting for Slingshot to see it.
      queryClient.setQueryData(
        createQueryKey(activeDecorationsQueryRoot, {
          did: savedDid,
          slingshot: savedSlingshot,
        }),
        next,
      )
    },
  })
}
