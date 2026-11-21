import {parseCidSafe} from '@atproto/lex'

/*
 * The repo registers a manual mock for multiformats/cid (__mocks__) that every
 * test picks up automatically. These tests exercise real CID parsing.
 */
jest.unmock('multiformats/cid')

import {
  buildDecorationRecord,
  getDecorationSettings,
  parseDecorationSettings,
  SETTINGS_COLLECTION,
  SETTINGS_RKEY,
} from './records'

const SUBJECT = 'did:plc:subscriber'
const SLINGSHOT = 'https://slingshot.microcosm.blue'
const originalFetch = global.fetch

describe('getDecorationSettings', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reads the settings record through slingshot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          value: {
            $type: SETTINGS_COLLECTION,
            avatar: 'gold-ring',
            avatarShape: 'hexagon',
            name: 'sunset',
            nameOutline: true,
          },
        }),
    } as Response)

    await expect(getDecorationSettings(SUBJECT, SLINGSHOT)).resolves.toEqual({
      avatar: 'gold-ring',
      avatarShape: 'hexagon',
      name: 'sunset',
      nameOutline: true,
    })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.origin).toBe(SLINGSHOT)
    expect(url.pathname).toBe('/xrpc/com.atproto.repo.getRecord')
    expect(url.searchParams.get('repo')).toBe(SUBJECT)
    expect(url.searchParams.get('collection')).toBe(SETTINGS_COLLECTION)
    expect(url.searchParams.get('rkey')).toBe(SETTINGS_RKEY)
  })

  it('treats a missing record as no decoration', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({error: 'RecordNotFound'}),
    } as Response)

    await expect(getDecorationSettings(SUBJECT, SLINGSHOT)).resolves.toEqual({})
  })

  it('throws on a real service failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    } as Response)

    await expect(getDecorationSettings(SUBJECT, SLINGSHOT)).rejects.toThrow(
      'Slingshot getRecord failed: 502',
    )
  })
})

describe('parseDecorationSettings', () => {
  it('drops unknown and malformed slots', () => {
    expect(
      parseDecorationSettings({
        avatar: 42,
        avatarShape: 'octagon',
        name: 'sunset',
        nameOutline: 'yes',
      }),
    ).toEqual({name: 'sunset'})
  })

  it('accepts every supported avatar shape', () => {
    for (const shape of ['circle', 'square', 'squircle', 'hexagon']) {
      expect(parseDecorationSettings({avatarShape: shape})).toEqual({
        avatarShape: shape,
      })
    }
  })

  it('returns an empty object for a missing record value', () => {
    expect(parseDecorationSettings(undefined)).toEqual({})
    expect(parseDecorationSettings(null)).toEqual({})
  })
})

describe('buildDecorationRecord', () => {
  it('carries over slots the patch does not touch', () => {
    const record = buildDecorationRecord(
      {avatar: 'gold-ring', name: 'sunset', nameOutline: true},
      {name: 'ocean'},
    )
    expect(record).toMatchObject({
      $type: SETTINGS_COLLECTION,
      avatar: 'gold-ring',
      name: 'ocean',
      nameOutline: true,
    })
    expect(typeof record.updatedAt).toBe('string')
  })

  it('omits a cleared slot instead of writing undefined', () => {
    const record = buildDecorationRecord(
      {avatar: 'gold-ring', name: 'sunset', nameOutline: true},
      {name: undefined},
    )
    expect(record).not.toHaveProperty('name')
    expect(record).not.toHaveProperty('nameOutline')
    expect(record).toMatchObject({avatar: 'gold-ring'})
  })

  it('drops the outline when the gradient it belongs to is cleared', () => {
    expect(
      buildDecorationRecord({nameOutline: true}, {name: undefined}),
    ).not.toHaveProperty('nameOutline')
  })

  it('writes a shape on its own', () => {
    expect(buildDecorationRecord({}, {avatarShape: 'hexagon'})).toMatchObject({
      avatarShape: 'hexagon',
    })
  })
})

describe('custom paint slots', () => {
  it('reads colors, gradients, and fonts from a record', () => {
    expect(
      parseDecorationSettings({
        avatarColor: '#ABCDEF',
        nameColor: 'abc',
        nameGradient: {colors: ['#FF0000', '#00FF00'], hard: true},
        nameFont: 'Inter',
      }),
    ).toEqual({
      avatarColor: '#abcdef',
      nameColor: '#aabbcc',
      nameGradient: {colors: ['#ff0000', '#00ff00'], hard: true},
      nameFont: 'Inter',
    })
  })

  it('rejects gradient and font shapes this build cannot render', () => {
    expect(
      parseDecorationSettings({
        nameGradient: {colors: ['#FF0000']},
        nameFont: 'Inter; background: red',
      }),
    ).toEqual({})
    expect(
      parseDecorationSettings({nameGradient: {colors: ['red', 'blue']}}),
    ).toEqual({})
    expect(
      parseDecorationSettings({
        nameGradient: {colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF']},
      }),
    ).toEqual({})
  })

  it('stores one name paint and clears the others', () => {
    const gradient = buildDecorationRecord(
      {name: 'sunset', nameColor: '#123456'},
      {nameGradient: {colors: ['#FF0000', '#0000FF']}},
    )
    expect(gradient).toMatchObject({
      nameGradient: {colors: ['#ff0000', '#0000ff']},
    })
    expect(gradient).not.toHaveProperty('name')
    expect(gradient).not.toHaveProperty('nameColor')

    // Callers clear the other paint explicitly; a gradient left in place wins.
    const solid = buildDecorationRecord(
      {name: 'sunset', nameGradient: {colors: ['#FF0000', '#0000FF']}},
      {nameColor: '#123456', nameGradient: undefined},
    )
    expect(solid.nameColor).toBe('#123456')
    expect(solid).not.toHaveProperty('name')
    expect(solid).not.toHaveProperty('nameGradient')
  })

  it('keeps a name paint on a record that names two of them', () => {
    // A record written by another client could carry both; the gradient wins.
    const record = buildDecorationRecord(
      {nameColor: '#123456', nameGradient: {colors: ['#FF0000', '#0000FF']}},
      {},
    )
    expect(record).toHaveProperty('nameGradient')
    expect(record).not.toHaveProperty('nameColor')
  })

  it('keeps the outline for a custom paint and drops it for a lone font', () => {
    expect(
      buildDecorationRecord(
        {nameOutline: true},
        {nameColor: '#123456'},
      ).nameOutline,
    ).toBe(true)
    expect(
      buildDecorationRecord({nameOutline: true}, {nameFont: 'Inter'}),
    ).not.toHaveProperty('nameOutline')
  })
})

describe('animated avatar slot', () => {
  const blob = {
    $type: 'blob' as const,
    ref: parseCidSafe(
      'bafkreiass37k5huajyfh6lzq6tndfhbsr6epvhoxz5diu4lj4rujcl3l4u',
    )!,
    mimeType: 'image/gif',
    size: 2048,
  }

  it('reads a stored animation and keeps its cid', () => {
    const parsed = parseDecorationSettings({
      avatarAnimated: {
        $type: 'blob',
        ref: {$link: blob.ref.toString()},
        mimeType: 'image/gif',
        size: 2048,
      },
    })
    const stored = parsed.avatarAnimated as {
      mimeType: string
      size?: number
      ref: {toString: () => string}
    }
    expect(stored.mimeType).toBe('image/gif')
    expect(stored.size).toBe(2048)
    expect(stored.ref.toString()).toBe(blob.ref.toString())
  })

  it('drops an animation this build cannot render', () => {
    expect(
      parseDecorationSettings({
        avatarAnimated: {$type: 'blob', ref: {$link: blob.ref.toString()}, mimeType: 'image/svg+xml', size: 10},
      }),
    ).toEqual({})
  })

  it('writes and clears the slot', () => {
    expect(
      buildDecorationRecord({}, {avatarAnimated: blob}).avatarAnimated,
    ).toBe(blob)
    expect(
      buildDecorationRecord({avatarAnimated: blob}, {avatarAnimated: undefined}),
    ).not.toHaveProperty('avatarAnimated')
  })
})
