import {Text} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {useTheme} from '#/alf'
import {
  type ProfileTheme,
  ProfileThemeScope,
  profileThemeTarget,
  resolveProfileTheme,
} from './profileTheme'
import {colorSetToScheme} from './semanticTheme'
import {type ThemeColorSet, type ThemeRecord} from './types'

const URI = 'at://did:plc:owner/app.witchsky.theme.colors/3mug7d56zc42i'

describe('profileThemeTarget', () => {
  it('splits a theme pointer into its repo and record', () => {
    expect(profileThemeTarget({uri: URI, colorSet: 'Midnight'})).toEqual({
      repo: 'did:plc:owner',
      rkey: '3mug7d56zc42i',
      colorSet: 'Midnight',
    })
  })

  it('refuses a pointer at any other collection', () => {
    expect(
      profileThemeTarget({
        uri: 'at://did:plc:owner/app.bsky.actor.profile/self',
      }),
    ).toBeUndefined()
  })

  it('refuses malformed pointers', () => {
    expect(profileThemeTarget(undefined)).toBeUndefined()
    expect(
      profileThemeTarget({uri: 'at://did:plc:owner/app.witchsky.theme.colors'}),
    ).toBeUndefined()
  })
})

describe('colorSetToScheme', () => {
  const set: ThemeColorSet = {
    name: 'Night',
    colors: {
      canvas: '#101010',
      surface: '#181818',
      surfaceRaised: '#202020',
      text: '#f5f5f5',
      textMuted: '#a0a0a0',
      border: '#303030',
      accent: '#c4ff00',
      accentSoft: '#334400',
      onAccent: '#101010',
      positive: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444',
      favorite: '#ec4899',
    },
  }

  it('paints every appearance slot with the authored set', () => {
    const scheme = colorSetToScheme(set, 'dark')
    for (const theme of [scheme.light, scheme.dark, scheme.dim]) {
      expect(theme.palette.contrast_0).toBe('#101010')
      expect(theme.palette.primary_500).toBe('#c4ff00')
      expect(theme.scheme).toBe('dark')
    }
  })

  it('publishes the same palette the theme resolves to', () => {
    const scheme = colorSetToScheme(set, 'light')
    expect(scheme.lightPalette).toBe(scheme.light.palette)
    expect(scheme.darkPalette).toBe(scheme.dark.palette)
    expect(scheme.dimPalette).toBe(scheme.dim.palette)
  })
})

describe('ProfileThemeScope', () => {
  const set: ThemeColorSet = {
    name: 'Night',
    colors: {
      canvas: '#101010',
      surface: '#181818',
      surfaceRaised: '#202020',
      text: '#f5f5f5',
      textMuted: '#a0a0a0',
      border: '#303030',
      accent: '#c4ff00',
      accentSoft: '#334400',
      onAccent: '#101010',
      positive: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444',
      favorite: '#ec4899',
    },
  }

  function Probe() {
    const t = useTheme()
    return <Text testID="canvas">{t.atoms.bg.backgroundColor}</Text>
  }

  it('paints children with the authored canvas', () => {
    const theme: ProfileTheme = {
      colorSet: set,
      mode: 'dark',
      name: 'Night',
      uri: URI,
    }
    render(
      <ProfileThemeScope theme={theme}>
        <Probe />
      </ProfileThemeScope>,
    )
    expect(screen.getByTestId('canvas').props.children).toBe('#101010')
  })

  it('leaves children on the viewer theme when there is no profile theme', () => {
    render(
      <ProfileThemeScope theme={undefined}>
        <Probe />
      </ProfileThemeScope>,
    )
    expect(screen.getByTestId('canvas').props.children).not.toBe('#101010')
  })
})

describe('resolveProfileTheme', () => {
  const colors: ThemeColorSet['colors'] = {
    canvas: '#101010',
    surface: '#181818',
    surfaceRaised: '#202020',
    text: '#f5f5f5',
    textMuted: '#a0a0a0',
    border: '#303030',
    accent: '#c4ff00',
    accentSoft: '#334400',
    onAccent: '#101010',
    positive: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
    favorite: '#ec4899',
  }
  const record: ThemeRecord = {
    $type: 'app.witchsky.theme.colors',
    name: 'Night',
    mode: 'dark',
    base: {name: 'Night', colors},
    variants: [{name: 'Dusk', colors: {accent: '#ff0088'}}],
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('takes the color set the pointer names', () => {
    const theme = resolveProfileTheme({uri: URI, record}, 'Dusk')
    expect(theme?.colorSet.name).toBe('Dusk')
    expect(theme?.colorSet.colors.accent).toBe('#ff0088')
    expect(theme?.mode).toBe('dark')
  })

  it('falls back to the base set when the named variant is gone', () => {
    const theme = resolveProfileTheme({uri: URI, record}, 'Deleted')
    expect(theme?.colorSet.name).toBe('Night')
  })

  it('keeps a Material You record exactly as published', () => {
    const material: ThemeRecord = {
      ...record,
      special: {
        $type: 'app.witchsky.theme.colors#materialYou',
        accent: '#ff0000',
      },
    }
    const theme = resolveProfileTheme({uri: URI, record: material})
    expect(theme?.colorSet.colors).toEqual(colors)
    expect(theme?.mode).toBe('dark')
  })
})
