/** @jest-environment jsdom */

import {act} from 'react'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

import {type BluemojiItem} from '#/features/bluemoji/util'
import {type BluemojiPack, type PackMembership} from './packs/util'
import {EmojiGrid} from './Picker'

jest.mock('react-native', () => jest.requireActual('react-native-web'))

const mockPacks = [
  {
    uri: 'at://did:plc:me/blue.moji.packs.pack/cats',
    record: {name: 'cats'},
  },
  {
    uri: 'at://did:plc:me/blue.moji.packs.pack/dogs',
    record: {name: 'dogs'},
  },
] as BluemojiPack[]

const mockItems = [
  {uri: 'at://did:plc:me/blue.moji.collection.item/a', record: {name: ':a:'}},
  {uri: 'at://did:plc:me/blue.moji.collection.item/b', record: {name: ':b:'}},
] as BluemojiItem[]

const mockMemberships = [
  {
    uri: 'at://did:plc:me/blue.moji.packs.packitem/1',
    subject: mockItems[0].uri,
    pack: mockPacks[0].uri,
  },
  {
    uri: 'at://did:plc:me/blue.moji.packs.packitem/2',
    subject: mockItems[1].uri,
    pack: mockPacks[1].uri,
  },
] as PackMembership[]

jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  web: (value: unknown) => value,
  useTheme: () => ({
    atoms: new Proxy({}, {get: () => ({})}),
    palette: {},
    name: 'light',
  }),
}))

jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: 'did:plc:me'}}),
}))

jest.mock('#/state/preferences/bluemoji-instance', () => ({
  readBluemojiInstance: () => 'https://emoji.example',
}))

jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => false,
}))

jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))

jest.mock('#/lib/shapes', () => ({getShapeStyle: () => ({})}))

jest.mock('#/components/Skeleton', () => ({
  Skeleton: {Block: () => null},
}))

jest.mock('#/components/icons/Emoji', () => ({
  EmojiHeartEyes_Stroke2_Corner0_Rounded: () => null,
}))

jest.mock('#/components/icons/Plus', () => ({
  PlusLarge_Stroke2_Corner0_Rounded: () => null,
}))

jest.mock('#/features/bluemoji/BluemojiImage', () => ({
  BluemojiImage: () => null,
}))

jest.mock('#/features/bluemoji/reactions/ReactionEmoji', () => ({
  ReactionEmoji: () => null,
}))

jest.mock('#/features/bluemoji/reactions/util', () => ({
  reactionEmojiToItem: (item: BluemojiItem) => item,
}))

jest.mock('#/features/bluemoji/reactions/queries', () => ({
  useTrendingEmojiQuery: () => ({
    data: undefined,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('#/features/bluemoji/queries', () => ({
  useBluemojiItemQuery: () => ({data: undefined}),
  useBluemojiSearchQuery: () => ({
    data: undefined,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('#/features/bluemoji/collection/queries', () => ({
  useOwnCollectionQuery: () => ({
    data: mockItems,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('#/features/bluemoji/packs/queries', () => ({
  useOwnPacksQuery: () => ({
    data: {packs: mockPacks, counts: {}, memberships: mockMemberships},
    isPending: false,
  }),
}))

jest.mock('#/components/Dialog', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  const box = ({children}: React.PropsWithChildren) =>
    react.createElement(View, null, children)
  return {
    useDialogControl: () => ({
      open: jest.fn(),
      close: jest.fn(),
      isOpen: false,
    }),
    Outer: box,
    Handle: box,
    ScrollableInner: box,
    Close: box,
  }
})

jest.mock('#/components/forms/TextField', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {
    Root: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
    Input: ({
      label,
      testID,
      placeholder,
      onChangeText,
    }: {
      label: string
      testID?: string
      placeholder?: string
      onChangeText?: (text: string) => void
    }) =>
      react.createElement('input', {
        'aria-label': label,
        placeholder,
        'data-testid': testID,
        onChange: (event: {target: {value: string}}) =>
          onChangeText?.(event.target.value),
      }),
  }
})

jest.mock('#/components/forms/SegmentedControl', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {
    Root: ({children}: React.PropsWithChildren) =>
      react.createElement(View, {testID: 'emojiTabs'}, children),
    Item: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
    ItemText: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
  }
})

jest.mock('#/components/Button', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {
    Button: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
    ButtonText: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
  }
})

jest.mock('#/components/Typography', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {Text}
})

function setup() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onClick = jest.fn()
  act(() =>
    root.render(
      <I18nProvider i18n={i18n}>
        <div onClick={onClick}>
          <EmojiGrid repo="did:plc:me" onSelect={jest.fn()} />
        </div>
      </I18nProvider>,
    ),
  )
  return {
    container,
    onClick,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

it('groups own emoji by pack and keeps search taps off the post link', () => {
  const screen = setup()

  const text = screen.container.textContent ?? ''
  expect(text.indexOf('cats')).toBeGreaterThanOrEqual(0)
  expect(text.indexOf('cats')).toBeLessThan(text.indexOf('dogs'))

  const tabs = screen.container.querySelector('[data-testid="emojiTabs"]')
  const search = screen.container.querySelector(
    '[data-testid="bluemojiSearch"]',
  )
  if (!tabs || !search) throw new Error('picker did not render its controls')

  act(() => {
    tabs.dispatchEvent(new MouseEvent('click', {bubbles: true}))
  })
  expect(screen.onClick).toHaveBeenCalledTimes(1)

  act(() => {
    search.dispatchEvent(new MouseEvent('click', {bubbles: true}))
  })
  expect(screen.onClick).toHaveBeenCalledTimes(1)

  screen.unmount()
})
