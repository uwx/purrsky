import {describe, expect, it} from '@jest/globals'

import {
  APPVIEW_PRESETS,
  getActiveAppViewPreset,
  getActiveAppViewTitle,
} from '#/state/preferences/custom-appview-did'

describe('getActiveAppViewPreset', () => {
  it('resolves the Bluesky default from empty or build-default values', () => {
    expect(getActiveAppViewPreset(undefined, undefined)).toBe('bluesky')
    expect(getActiveAppViewPreset('did:web:api.bsky.app', undefined)).toBe(
      'bluesky',
    )
    expect(
      getActiveAppViewPreset(undefined, APPVIEW_PRESETS.bluesky.url),
    ).toBe('bluesky')
    expect(getActiveAppViewPreset(undefined, '')).toBe('bluesky')
  })

  it('resolves Eurosky from its DID or URL', () => {
    expect(
      getActiveAppViewPreset('did:web:api.eurosky.network', undefined),
    ).toBe('eurosky')
    expect(
      getActiveAppViewPreset(undefined, 'https://api.eurosky.network'),
    ).toBe('eurosky')
    expect(
      getActiveAppViewPreset(
        'did:web:api.eurosky.network',
        'https://api.eurosky.network/',
      ),
    ).toBe('eurosky')
  })

  it('resolves Blacksky from its DID or URL', () => {
    expect(
      getActiveAppViewPreset('did:web:api.blacksky.community', undefined),
    ).toBe('blacksky')
    expect(
      getActiveAppViewPreset(undefined, 'https://api.blacksky.community'),
    ).toBe('blacksky')
  })

  it('falls back to custom for other AppViews', () => {
    expect(getActiveAppViewPreset('did:web:deer.social', undefined)).toBe(
      'custom',
    )
    expect(
      getActiveAppViewPreset(undefined, 'https://api.example.com'),
    ).toBe('custom')
  })
})

describe('getActiveAppViewTitle', () => {
  it('uses the preset title', () => {
    expect(getActiveAppViewTitle(undefined, undefined)).toBe('Bluesky')
    expect(
      getActiveAppViewTitle('did:web:api.eurosky.network', undefined),
    ).toBe('Eurosky')
    expect(
      getActiveAppViewTitle(undefined, 'https://api.blacksky.community'),
    ).toBe('Blacksky')
  })

  it('shows the host for a custom AppView', () => {
    expect(
      getActiveAppViewTitle(undefined, 'https://api.example.com'),
    ).toBe('api.example.com')
    expect(getActiveAppViewTitle('did:web:api.example.com', undefined)).toBe(
      'api.example.com',
    )
  })
})
