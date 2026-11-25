import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook} from '@testing-library/react-native'

import {
  ITEM_COLLECTION,
  useCopyPackToCollectionMutation,
  useDeletePackMutation,
  useSetPackItemsMutation,
} from '#/features/bluemoji/packs/mutations'
import {
  type BluemojiPack,
  PACK_COLLECTION,
  PACK_ITEM_COLLECTION,
} from '#/features/bluemoji/packs/util'
import {type BluemojiItem} from '#/features/bluemoji/util'

jest.unmock('multiformats/cid')

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
jest.mock('#/features/bluemoji/packs/copy-blob', () => ({
  copyBlobToOwnRepo: jest.fn((_client, _url, mimeType) =>
    Promise.resolve({ref: {$link: 'bafycopy'}, mimeType}),
  ),
}))
jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest.fn(() => Promise.resolve('https://pds.example')),
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({confirm: jest.fn(), tap: jest.fn(), success: jest.fn()}),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

beforeAll(() => {
  const mock = jest.requireMock('#/state/session') as {
    __setPdsCall: () => jest.Mock
  }
  pdsCall = mock.__setPdsCall()
})

type Call = [{$nsid: string}, {collection?: string} & Record<string, unknown>]

function calls() {
  return pdsCall.mock.calls as Call[]
}

function writesTo(name: string) {
  return calls().filter(([def, params]) => {
    if (def.$nsid === 'com.atproto.repo.listRecords') return false
    return params.collection === name
  })
}

function listRecords(records: {uri: string; value: unknown}[]) {
  pdsCall.mockImplementation((def: {$nsid: string}) =>
    Promise.resolve(
      def.$nsid === 'com.atproto.repo.listRecords' ? {records} : {},
    ),
  )
}

const pack = {
  uri: 'at://did:plc:other/blue.moji.packs.pack/3kpack',
  cid: 'bafypack',
  did: 'did:plc:other',
  pdsUrl: 'https://pds.example',
  record: {
    $type: PACK_COLLECTION,
    name: 'cats',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
} as BluemojiPack

function emoji(name: string, license?: string): BluemojiItem {
  return {
    uri: `at://did:plc:other/blue.moji.collection.item/${name.replace(/:/g, '')}`,
    cid: `bafy${name.replace(/:/g, '')}`,
    did: 'did:plc:other',
    record: {
      $type: ITEM_COLLECTION,
      name,
      createdAt: '2026-01-01T00:00:00.000Z',
      license,
      formats: {
        $type: 'blue.moji.collection.item#formats_v1',
        png_128: {ref: {$link: 'bafyblob'}, mimeType: 'image/png'},
      },
    },
  } as unknown as BluemojiItem
}

function setup(queryClient: QueryClient) {
  return ({children}: {children: React.ReactNode}) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  listRecords([])
})

it('copies only licensed emoji, skipping aliases already in the collection', async () => {
  listRecords([
    {
      uri: 'at://did:plc:me/blue.moji.collection.item/mine',
      value: {
        $type: ITEM_COLLECTION,
        name: ':mine:',
        createdAt: '2026-01-01T00:00:00.000Z',
        formats: {$type: 'blue.moji.collection.item#formats_v1'},
      },
    },
  ])

  const queryClient = new QueryClient()
  const {result} = renderHook(() => useCopyPackToCollectionMutation(), {
    wrapper: setup(queryClient),
  })

  const summary = await result.current.mutateAsync({
    items: [
      emoji(':mine:', 'CC0-1.0'),
      emoji(':kept:', 'CC-BY-4.0'),
      emoji(':nope:', 'LicenseRef-manual'),
    ],
  })

  expect(summary).toEqual({copied: 1, skipped: 1, unlicensed: 1, failed: 0})
  const writes = writesTo(ITEM_COLLECTION)
  expect(writes).toHaveLength(1)
  expect(writes[0][1]).toMatchObject({
    rkey: 'kept',
    record: {
      name: ':kept:',
      copyOf: 'at://did:plc:other/blue.moji.collection.item/kept',
      license: 'CC-BY-4.0',
      formats: {
        $type: 'blue.moji.collection.item#formats_v1',
        png_128: {ref: {$link: 'bafycopy'}, mimeType: 'image/png'},
      },
    },
  })
})

it('does not add a membership for an emoji already in the pack', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSetPackItemsMutation(), {
    wrapper: setup(queryClient),
  })

  const item = emoji(':kept:', 'CC0-1.0')
  await result.current.mutateAsync({
    pack,
    add: [item],
    existing: [item.uri],
  })

  expect(writesTo(PACK_ITEM_COLLECTION)).toHaveLength(0)
})

it('deletes the memberships before the pack record', async () => {
  listRecords([
    {
      uri: 'at://did:plc:me/blue.moji.packs.packitem/3kitem',
      value: {
        $type: PACK_ITEM_COLLECTION,
        pack: pack.uri,
        subject: emoji(':kept:').uri,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  ])

  const queryClient = new QueryClient()
  const {result} = renderHook(() => useDeletePackMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({pack})

  const deletions = calls().filter(
    ([def]) => def.$nsid === 'com.atproto.repo.deleteRecord',
  )
  expect(deletions).toHaveLength(2)
  expect(deletions[0][1]).toMatchObject({
    collection: PACK_ITEM_COLLECTION,
    rkey: '3kitem',
  })
  expect(deletions[1][1]).toMatchObject({
    collection: PACK_COLLECTION,
    rkey: '3kpack',
  })
})

function membership(packUri: string, rkey: string, subject: string) {
  return {
    uri: `at://did:plc:me/${PACK_ITEM_COLLECTION}/${rkey}`,
    value: {
      $type: PACK_ITEM_COLLECTION,
      pack: packUri,
      subject,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  }
}

const itemUri = (rkey: string) => `at://did:plc:me/${ITEM_COLLECTION}/${rkey}`

it('deletes the collection items too, after their memberships', async () => {
  listRecords([
    membership(pack.uri, '3kone', itemUri('one')),
    membership(pack.uri, '3ktwo', itemUri('two')),
  ])

  const queryClient = new QueryClient()
  const {result} = renderHook(() => useDeletePackMutation(), {
    wrapper: setup(queryClient),
  })

  const summary = await result.current.mutateAsync({pack, deleteItems: true})

  const deletions = calls()
    .filter(([def]) => def.$nsid === 'com.atproto.repo.deleteRecord')
    .map(([, params]) => `${String(params.collection)}/${String(params.rkey)}`)
  expect(deletions).toEqual([
    `${PACK_ITEM_COLLECTION}/3kone`,
    `${PACK_ITEM_COLLECTION}/3ktwo`,
    `${ITEM_COLLECTION}/one`,
    `${ITEM_COLLECTION}/two`,
    `${PACK_COLLECTION}/3kpack`,
  ])
  expect(summary).toEqual({name: 'cats', deletedItems: 2, keptItems: 0})
})

it('keeps an emoji another pack still includes', async () => {
  const otherPack = 'at://did:plc:me/blue.moji.packs.pack/3kother'
  listRecords([
    membership(pack.uri, '3kone', itemUri('one')),
    membership(otherPack, '3kshared', itemUri('one')),
  ])

  const queryClient = new QueryClient()
  const {result} = renderHook(() => useDeletePackMutation(), {
    wrapper: setup(queryClient),
  })

  const summary = await result.current.mutateAsync({pack, deleteItems: true})

  const deletions = calls()
    .filter(([def]) => def.$nsid === 'com.atproto.repo.deleteRecord')
    .map(([, params]) => `${String(params.collection)}/${String(params.rkey)}`)
  expect(deletions).toEqual([
    `${PACK_ITEM_COLLECTION}/3kone`,
    `${PACK_COLLECTION}/3kpack`,
  ])
  expect(summary).toEqual({name: 'cats', deletedItems: 0, keptItems: 1})
})

it('never deletes an item that lives in another repo', async () => {
  // A membership may point at an emoji some other account owns; only records
  // in our own repo are ours to delete.
  listRecords([
    membership(
      pack.uri,
      '3kone',
      'at://did:plc:other/blue.moji.collection.item/theirs',
    ),
  ])

  const queryClient = new QueryClient()
  const {result} = renderHook(() => useDeletePackMutation(), {
    wrapper: setup(queryClient),
  })

  const summary = await result.current.mutateAsync({pack, deleteItems: true})

  expect(
    writesTo(ITEM_COLLECTION).filter(
      ([def]) => def.$nsid === 'com.atproto.repo.deleteRecord',
    ),
  ).toHaveLength(0)
  expect(summary).toEqual({name: 'cats', deletedItems: 0, keptItems: 1})
})
