import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook} from '@testing-library/react-native'

import {uploadBlob} from '#/lib/api'
import {type PickerImage} from '#/lib/media/picker.shared'
import {
  ITEM_COLLECTION,
  useBulkEmojiMutation,
  useDeleteEmojiMutation,
  useSaveEmojiMutation,
} from '#/features/bluemoji/collection/mutations'
import {type PreparedEmojiImage} from '#/features/bluemoji/collection/prepare'
import {OWN_COLLECTION_ROOT} from '#/features/bluemoji/collection/queries'
import {type BluemojiItem} from '#/features/bluemoji/util'

jest.unmock('multiformats/cid')

/**
 * An upload result carrying a link. The real one is a lex `BlobRef`, but only
 * the link reaches the record, so the rest is filled in just enough to type.
 */
function blob(link: string) {
  return {
    blob: {$type: 'blob', ref: {$link: link}, mimeType: 'image/png', size: 1},
  } as unknown as Awaited<ReturnType<typeof uploadBlob>>
}

/** A picked file; only the path and mime reach the mocked upload. */
function picked(path: string): PickerImage {
  return {path, mime: 'image/png', width: 128, height: 128, size: 1024}
}

type CallParams = {
  rkey?: string
  collection?: string
  record?: {formats?: Record<string, unknown>} & Record<string, unknown>
}

let pdsCall: jest.Mock

jest.mock('#/state/session', () => {
  const call = jest.fn()
  const pdsClient = {did: 'did:plc:me', assertDid: 'did:plc:me', call}
  return {
    __esModule: true,
    pdsClient,
    usePdsClient: () => pdsClient,
    __setPdsCall: () => call,
  }
})
jest.mock('#/lib/api', () => ({
  uploadBlob: jest.fn(() => Promise.resolve({blob: {ref: {$link: 'bafynew'}}})),
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({confirm: jest.fn(), tap: jest.fn(), success: jest.fn()}),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
/*
 * The pack writers import this via `packs/mutations`, and its real module pulls
 * in the session agent (and the analytics Logger this file stubs out).
 */
jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest.fn(),
}))

beforeAll(() => {
  const mock = jest.requireMock('#/state/session') as {
    __setPdsCall: () => jest.Mock
  }
  pdsCall = mock.__setPdsCall()
})

/** The mock is untyped through `requireMock`, so assert the shape once here. */
function calls() {
  return pdsCall.mock.calls as [{$nsid?: string}, CallParams][]
}

/** An item whose rkey does not match its alias, as historical collections have. */
const item = {
  uri: 'at://did:plc:me/blue.moji.collection.item/hist0rical',
  cid: 'bafyitem',
  did: 'did:plc:me',
  record: {
    $type: 'blue.moji.collection.item',
    name: ':blobcat:',
    alt: 'a cat',
    createdAt: '2026-01-01T00:00:00.000Z',
    formats: {$type: 'blue.moji.collection.item#formats_v1', png_128: 'kept'},
  },
} as unknown as BluemojiItem

function setup(queryClient: QueryClient) {
  return ({children}: {children: React.ReactNode}) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  pdsCall.mockResolvedValue({})
})

it('edits in place, keeping the record rkey and its renditions', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    alt: 'new',
    editing: item,
  })

  const [def, params] = calls()[0]
  expect(def.$nsid).toBe('com.atproto.repo.putRecord')
  expect(params).toMatchObject({
    collection: ITEM_COLLECTION,
    // Not `blobcat`, which is what deriving the rkey from the alias would give.
    rkey: 'hist0rical',
    record: {
      name: ':blobcat:',
      alt: 'new',
      createdAt: '2026-01-01T00:00:00.000Z',
      formats: {$type: 'blue.moji.collection.item#formats_v1', png_128: 'kept'},
    },
  })
  expect(calls()).toHaveLength(1)
})

it('renames by writing the new rkey and deleting the old one', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({alias: ':newcat:', editing: item})

  expect(calls()).toHaveLength(2)
  expect(calls()[0][1]).toMatchObject({rkey: 'newcat'})
  expect(calls()[1][0].$nsid).toBe('com.atproto.repo.deleteRecord')
  expect(calls()[1][1]).toMatchObject({rkey: 'hist0rical'})
})

it('replaces the renditions when a new image is picked', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    image: {image: picked('/tmp/cat.png'), rendition: 'png_128'},
    editing: item,
  })

  expect(calls()[0][1].record?.formats?.png_128).toEqual({
    ref: {$link: 'bafynew'},
  })
  expect(jest.mocked(uploadBlob)).toHaveBeenCalledTimes(1)
})

it('writes animated bytes to their own slot and a still alongside them', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    image: {
      image: picked('/tmp/cat.png'),
      rendition: 'apng_128',
      still: picked('/tmp/cat-still.png'),
    } satisfies PreparedEmojiImage,
  })

  // Two uploads: the animated original first, its first frame second.
  expect(jest.mocked(uploadBlob).mock.calls.map(([, input]) => input)).toEqual([
    '/tmp/cat.png',
    '/tmp/cat-still.png',
  ])
  const formats = calls()[0][1].record?.formats
  expect(Object.keys(formats ?? {})).toEqual(['$type', 'apng_128', 'png_128'])
  expect(formats?.apng_128).toEqual({ref: {$link: 'bafynew'}})
  expect(formats?.png_128).toEqual({ref: {$link: 'bafynew'}})
})

it('uses the still as the pack icon rather than an animation nobody sees', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useBulkEmojiMutation(), {
    wrapper: setup(queryClient),
  })
  const image: PreparedEmojiImage = {
    image: picked('/tmp/cat.png'),
    rendition: 'apng_128',
    still: picked('/tmp/cat-still.png'),
  }
  // Distinct links per upload, so "the icon is the still" is falsifiable.
  jest
    .mocked(uploadBlob)
    .mockResolvedValueOnce(blob('bafyanim'))
    .mockResolvedValueOnce(blob('bafystill'))

  await result.current.mutateAsync({
    drafts: [{alias: ':one:', image}],
    pack: {name: 'cats'},
  })

  const pack = calls().find(
    ([, params]) => params.collection === 'blue.moji.packs.pack',
  )
  expect(pack?.[1].record).toMatchObject({icon: {ref: {$link: 'bafystill'}}})
  expect(calls()[0][1].record?.formats?.apng_128).toMatchObject({
    ref: {$link: 'bafyanim'},
  })
})

it('deletes by the record rkey, not the alias', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData([OWN_COLLECTION_ROOT, {did: 'did:plc:me'}], [item])
  const {result} = renderHook(() => useDeleteEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync(item)

  expect(calls()[0][0].$nsid).toBe('com.atproto.repo.deleteRecord')
  expect(calls()[0][1]).toMatchObject({rkey: 'hist0rical'})
})

it('writes the licence that lets others copy the emoji', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    license: ' CC0-1.0 ',
    image: {image: picked('/tmp/cat.png'), rendition: 'png_128'},
  })

  expect(calls()[0][1].record).toMatchObject({license: 'CC0-1.0'})
})

it('keeps the stored licence when an edit does not mention one', async () => {
  const queryClient = new QueryClient()
  const licensed = {
    ...item,
    record: {...item.record, license: 'CC-BY-4.0'},
  } as BluemojiItem
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  // The bulk flow never sets a licence and must not erase what a single edit
  // wrote earlier.
  await result.current.mutateAsync({alias: ':blobcat:', editing: licensed})

  expect(calls()[0][1].record).toMatchObject({license: 'CC-BY-4.0'})
})

it('clears the licence when asked to', async () => {
  const queryClient = new QueryClient()
  const licensed = {
    ...item,
    record: {...item.record, license: 'CC-BY-4.0'},
  } as BluemojiItem
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    license: '  ',
    editing: licensed,
  })

  // Absent once serialised, not an empty string: "unspecified" is the absence
  // of a value.
  expect(calls()[0][1].record?.license).toBeUndefined()
})

it('creates a pack from a bulk upload and adds every written emoji to it', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useBulkEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  const image: PreparedEmojiImage = {
    image: picked('/tmp/cat.png'),
    rendition: 'png_128',
  }
  const outcome = await result.current.mutateAsync({
    drafts: [
      {alias: ':one:', image, license: 'CC0-1.0'},
      {alias: ':two:', image, license: 'CC0-1.0'},
    ],
    pack: {name: ' cute cats '},
  })

  expect(outcome).toMatchObject({added: 2, failed: []})
  expect(outcome.packError).toBeUndefined()

  const collections = calls().map(([, params]) => params.collection)
  expect(collections).toEqual([
    ITEM_COLLECTION,
    ITEM_COLLECTION,
    'blue.moji.packs.pack',
    'blue.moji.packs.packitem',
    'blue.moji.packs.packitem',
  ])

  const pack = calls()[2][1]
  expect(pack.record).toMatchObject({
    $type: 'blue.moji.packs.pack',
    name: 'cute cats',
    // The first written emoji's own rendition, so the pack uploads no icon.
    icon: {ref: {$link: 'bafynew'}},
  })

  const packUri = `at://did:plc:me/blue.moji.packs.pack/${pack.rkey}`
  const members = calls()
    .slice(3)
    .map(([, params]) => params.record)
  expect(members).toEqual([
    expect.objectContaining({
      pack: packUri,
      subject: `at://did:plc:me/${ITEM_COLLECTION}/one`,
    }),
    expect.objectContaining({
      pack: packUri,
      subject: `at://did:plc:me/${ITEM_COLLECTION}/two`,
    }),
  ])
})

it('reports a pack failure without losing the emoji that saved', async () => {
  const queryClient = new QueryClient()
  pdsCall.mockImplementation((_def: unknown, params?: CallParams) => {
    if (params?.collection === 'blue.moji.packs.pack')
      return Promise.reject(new Error('nope'))
    return Promise.resolve({})
  })
  const {result} = renderHook(() => useBulkEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  const outcome = await result.current.mutateAsync({
    drafts: [
      {
        alias: ':one:',
        image: {image: picked('/tmp/a.png'), rendition: 'png_128'},
      },
    ],
    pack: {name: 'cats'},
  })

  expect(outcome).toMatchObject({added: 1, failed: [], packError: 'cats'})
  // No membership is attempted for a pack that was never written.
  expect(
    calls().filter(
      ([, params]) => params.collection === 'blue.moji.packs.packitem',
    ),
  ).toHaveLength(0)
})
