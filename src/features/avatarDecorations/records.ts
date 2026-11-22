import {type BlobRef} from '@atproto/lex'

import {parseAnimatedAvatarBlob} from './animatedAvatar'
import {type AvatarShape, isAvatarShape} from './avatarShapes'
import {normalizeHex} from './oklch'

/**
 * Cosmetic choices, a self-record in the owner's PDS, written directly by the
 * app with the user's session. One record holds every slot (avatar frame,
 * avatar shape, name gradient, ...). Any account that writes one renders with
 * decorations; there is no allowlist.
 */
export const SETTINGS_COLLECTION = 'social.mu.deco.settings'
export const SETTINGS_RKEY = 'self'

/**
 * A published `app.witchsky.theme.colors` record shown as this profile's
 * theme. The record is only a pointer; the theme itself is fetched separately,
 * so an edit to the theme updates the profile without rewriting decorations.
 */
export type ProfileThemeRef = {
  /** `at://<repo>/<collection>/<rkey>` of the theme record. */
  uri: string
  /** Color set inside that record; the base set when absent. */
  colorSet?: string
}

/** An arbitrary two- or three-stop name gradient. */
export type NameGradientPaint = {
  /** `#rrggbb` stops, left to right. */
  colors: string[]
  /** Draw hard color bands instead of blending between stops. */
  hard?: boolean
}

/** Resolved slot ids from a settings record; each maps to its own catalog. */
export type DecorationSettings = {
  /** Avatar frame id (catalog.ts). */
  avatar?: string
  /** Preferred shape for this profile picture (avatarShapes.ts). */
  avatarShape?: AvatarShape
  /** Display-name gradient id (nameGradients.ts). */
  name?: string
  /** Draw an edge around the name so it pops on any background. */
  nameOutline?: boolean
  /** Ring stroke color, overriding the frame's own color. */
  avatarColor?: string
  /** Arbitrary solid display-name color. */
  nameColor?: string
  /** Arbitrary display-name gradient. */
  nameGradient?: NameGradientPaint
  /** Google Fonts family for the display name (googleFonts.ts). */
  nameFont?: string
  /**
   * Animated profile picture (animatedAvatar.ts), played instead of
   * `app.bsky.actor.profile#avatar` by clients that understand it.
   */
  avatarAnimated?: BlobRef
  /** Published theme this profile is painted with. */
  profileTheme?: ProfileThemeRef
}

/** Families are capped so a junk record cannot bloat a feed row. */
const MAX_FONT_FAMILY_LENGTH = 40

/**
 * Fetches the subject's decoration settings record. Goes through Slingshot
 * (microcosm's cached record fetcher) rather than the AppView: the AppView only
 * serves getRecord for collections it indexes (app.bsky.*), while Slingshot
 * resolves any DID to its PDS and edge-caches the record.
 */
export async function getDecorationSettings(
  did: string,
  slingshotService: string,
): Promise<DecorationSettings> {
  const url = new URL('/xrpc/com.atproto.repo.getRecord', slingshotService)
  url.searchParams.set('repo', did)
  url.searchParams.set('collection', SETTINGS_COLLECTION)
  url.searchParams.set('rkey', SETTINGS_RKEY)

  const res = await fetch(url.toString(), {
    headers: {accept: 'application/json'},
  })
  // RecordNotFound and friends: a granted account that never picked anything.
  if (res.status === 400 || res.status === 404) {
    const body = (await res.json().catch(() => ({}))) as {error?: unknown}
    if (body.error === 'RecordNotFound') return {}
  }
  if (!res.ok) {
    throw new Error(`Slingshot getRecord failed: ${res.status}`)
  }
  const json = (await res.json()) as {value?: unknown}
  return parseDecorationSettings(json.value)
}

/** Reads a custom gradient, or undefined when it is not a valid 2-3 stop paint. */
function parseNameGradient(value: unknown): NameGradientPaint | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.colors)) return undefined
  if (record.colors.length < 2 || record.colors.length > 3) return undefined
  const colors: string[] = []
  for (const stop of record.colors) {
    const hex = normalizeHex(stop)
    if (!hex) return undefined
    colors.push(hex)
  }
  return {...(record.hard === true ? {hard: true} : {}), colors}
}

/** Reads a font family this build might render, or undefined. */
function parseFontFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const family = value.trim()
  // Catalog families are letters, digits, and spaces only.
  if (!family || family.length > MAX_FONT_FAMILY_LENGTH) return undefined
  if (!/^[\w +-]+$/.test(family)) return undefined
  return family
}

/** A theme URI is a pointer into a public repo, never a fetch of its bytes. */
const MAX_THEME_URI_LENGTH = 300

/** Variant names come from a public record, so they are capped too. */
const MAX_COLOR_SET_NAME_LENGTH = 60

/**
 * Reads a pointer at a published theme, or undefined when it is not a plain
 * three-part AT URI. The collection is not checked here: this record layer
 * stays unaware of which collections the theme feature understands, and a
 * pointer at anything else simply fails to resolve.
 */
function parseProfileTheme(value: unknown): ProfileThemeRef | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.uri !== 'string') return undefined
  const uri = record.uri.trim()
  if (!uri || uri.length > MAX_THEME_URI_LENGTH || !uri.startsWith('at://')) {
    return undefined
  }
  const parts = uri.slice('at://'.length).split('/')
  if (parts.length !== 3) return undefined
  if (parts.some(part => !part || /[?#\s]/.test(part))) return undefined
  const colorSet =
    typeof record.colorSet === 'string' ? record.colorSet.trim() : ''
  return {
    uri,
    ...(colorSet && colorSet.length <= MAX_COLOR_SET_NAME_LENGTH
      ? {colorSet}
      : {}),
  }
}

/**
 * Ignores malformed optional slots received from a public record. Colors are
 * normalized to `#rrggbb` so every consumer can compare them by value.
 */
export function parseDecorationSettings(value: unknown): DecorationSettings {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const nameGradient = parseNameGradient(record.nameGradient)
  const nameFont = parseFontFamily(record.nameFont)
  const avatarAnimated = parseAnimatedAvatarBlob(record.avatarAnimated)
  const profileTheme = parseProfileTheme(record.profileTheme)
  return {
    ...(typeof record.avatar === 'string' ? {avatar: record.avatar} : {}),
    ...(isAvatarShape(record.avatarShape)
      ? {avatarShape: record.avatarShape}
      : {}),
    ...(typeof record.name === 'string' ? {name: record.name} : {}),
    ...(record.nameOutline === true ? {nameOutline: true} : {}),
    ...(normalizeHex(record.avatarColor)
      ? {avatarColor: normalizeHex(record.avatarColor)!}
      : {}),
    ...(normalizeHex(record.nameColor)
      ? {nameColor: normalizeHex(record.nameColor)!}
      : {}),
    ...(nameGradient ? {nameGradient} : {}),
    ...(nameFont ? {nameFont} : {}),
    ...(avatarAnimated ? {avatarAnimated} : {}),
    ...(profileTheme ? {profileTheme} : {}),
  }
}

/**
 * Builds the record to write for `patch` over `current`. putRecord replaces the
 * whole record, so every other slot has to be carried over explicitly, and a
 * slot cleared in `patch` must be omitted rather than written as undefined.
 *
 * Only one display-name paint can be stored, so writing one clears the others;
 * otherwise a record would carry a gradient this build could not name and a
 * color another build would render instead.
 */
export function buildDecorationRecord(
  current: DecorationSettings,
  patch: Partial<DecorationSettings>,
): DecorationSettings & {$type: string; updatedAt: string} {
  const next: DecorationSettings = {...current, ...patch}

  // At most one display-name paint is stored. A patch that names a paint clears
  // the others (the settings screen always sends every slot, so a cleared paint
  // arrives as undefined rather than as a survivor), and precedence decides
  // which paint wins if a foreign record ever carries two.
  let name = next.name
  let nameColor = normalizeHex(next.nameColor) ?? undefined
  let nameGradient = parseNameGradient(next.nameGradient)
  if (nameGradient) {
    nameColor = undefined
    name = undefined
  } else if (nameColor) {
    name = undefined
  }

  const avatarColor = normalizeHex(next.avatarColor) ?? undefined
  const nameFont = parseFontFamily(next.nameFont)
  const profileTheme = parseProfileTheme(next.profileTheme)
  const hasNamePaint = !!(name || nameColor || nameGradient)

  return {
    $type: SETTINGS_COLLECTION,
    updatedAt: new Date().toISOString(),
    ...(next.avatar ? {avatar: next.avatar} : {}),
    ...(next.avatarShape ? {avatarShape: next.avatarShape} : {}),
    ...(avatarColor ? {avatarColor} : {}),
    ...(name ? {name} : {}),
    ...(nameColor ? {nameColor} : {}),
    ...(nameGradient ? {nameGradient} : {}),
    ...(nameFont ? {nameFont} : {}),
    // The outline only means anything alongside a name paint.
    ...(hasNamePaint && next.nameOutline ? {nameOutline: true} : {}),
    ...(next.avatarAnimated ? {avatarAnimated: next.avatarAnimated} : {}),
    ...(profileTheme ? {profileTheme} : {}),
  }
}
