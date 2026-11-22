import {useMemo} from 'react'

import {Context, useAlf} from '#/alf'
import {type ProfileThemeRef} from '#/features/avatarDecorations/records'
import {useProfileThemeRef} from '#/features/avatarDecorations/useDecorations'
import {useThemeRecord} from './api'
import {colorSetToScheme} from './semanticTheme'
import {
  getColorSet,
  THEME_COLLECTION,
  type ThemeColorSet,
  type ThemeMode,
  type ThemeRecord,
} from './types'

/** A profile's theme, ready to paint a subtree with. */
export type ProfileTheme = {
  /** Colors the owner published, or the variant they selected. */
  colorSet: ThemeColorSet
  /** Appearance mode the theme was authored for. */
  mode: ThemeMode
  name: string
  uri: string
}

/**
 * Splits a stored pointer into the record it names. Only the theme collection
 * is accepted, so a decorations record cannot point the profile at an
 * unrelated public record and have it parsed as a theme.
 */
export function profileThemeTarget(ref: ProfileThemeRef | undefined) {
  if (!ref) return undefined
  const [repo, collection, rkey] = ref.uri.slice('at://'.length).split('/')
  if (!repo || !rkey || collection !== THEME_COLLECTION) return undefined
  return {repo, rkey, colorSet: ref.colorSet}
}

/**
 * The theme a decorated profile shows, taken from the published record as-is.
 * The record already carries the colors its author saved (a Material You theme
 * stores the palette it was generated with), so resolving never re-derives
 * anything from the viewer's own accent or wallpaper. Undefined only when the
 * record has no color sets at all.
 */
export function resolveProfileTheme(
  view: {uri: string; record: ThemeRecord},
  colorSetName?: string,
): ProfileTheme | undefined {
  const colorSet = getColorSet(view.record, colorSetName)
  if (!colorSet) return undefined
  return {
    colorSet,
    mode: view.record.mode,
    name: view.record.name,
    uri: view.uri,
  }
}

/**
 * The theme a profile shows, resolved from the pointer in its decorations
 * record. Undefined when the owner has none, the viewer asked to ignore
 * profile themes, or the record is gone or unsupported.
 *
 * `enabled` is false for a profile the viewer cannot see (a blurred profile),
 * since painting it would reveal the decoration before the content.
 */
export function useProfileTheme(
  did: string | undefined,
  enabled = true,
): ProfileTheme | undefined {
  const ref = useProfileThemeRef(did, enabled)
  const refUri = ref?.uri
  const refColorSet = ref?.colorSet
  // Parsing the pointer into a fresh object every render would rebuild the
  // context value and re-render the whole profile tree.
  const target = useMemo(
    () =>
      profileThemeTarget(
        refUri ? {uri: refUri, colorSet: refColorSet} : undefined,
      ),
    [refColorSet, refUri],
  )
  const query = useThemeRecord(target?.repo, target?.rkey)
  const theme = query.data

  return useMemo(
    () => (theme ? resolveProfileTheme(theme, target?.colorSet) : undefined),
    [target, theme],
  )
}

/**
 * Paints `children` with the profile theme. Renders the alf context directly
 * rather than nesting a ThemeProvider so font scale and every other piece of
 * parent state stay live. The three appearance slots resolve to the author's
 * own set, so the page keeps its published look in either appearance mode.
 */
export function ProfileThemeScope({
  theme,
  children,
}: {
  theme: ProfileTheme | undefined
  children: React.ReactNode
}) {
  const alf = useAlf()
  const value = useMemo(() => {
    if (!theme) return undefined
    const themes = {
      ...alf.themes,
      ...colorSetToScheme(theme.colorSet, theme.mode),
    }
    return {...alf, themes, theme: themes[alf.themeName]}
  }, [alf, theme])
  if (!value) return <>{children}</>
  return <Context.Provider value={value}>{children}</Context.Provider>
}
