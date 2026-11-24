import {useState} from 'react'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {Text} from '#/components/Typography'
import {applyDraftEdit, draftFromSaved, draftToPatch} from '../draft'
import {type DecorationSettings} from '../records'
import {DecorationsEditor} from './DecorationsEditor'

const i18n = setupI18n({locale: 'en', messages: {en: {}}})
const mockSave = jest.fn<void, [DecorationSettings]>()

jest.mock('@lingui/react/macro', () => {
  const actual = jest.requireActual('@lingui/react/macro')
  return {
    ...actual,
    Trans: ({children}: {children: React.ReactNode}) => children,
    useLingui: () => ({
      i18n: {
        _: (descriptor: {message?: string}) => descriptor.message ?? '',
      },
      t: (strings: TemplateStringsArray, ...values: unknown[]) =>
        strings.reduce(
          (acc, part, index) =>
            acc +
            part +
            (typeof values[index] === 'string' ? values[index] : ''),
          '',
        ),
    }),
  }
})
jest.mock('#/components/Dialog', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {View} = rn
  const Pass = ({children}: {children?: React.ReactNode}) =>
    h(View, null, children)
  return {
    useDialogControl: () => ({open: jest.fn(), close: jest.fn()}),
    useDialogContext: () => ({close: jest.fn()}),
    Outer: Pass,
    Handle: () => null,
    Close: () => null,
    ScrollableInner: Pass,
    InnerFlatList: () => null,
  }
})
jest.mock('reanimated-color-picker', () => {
  return {
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => children ?? null,
    Panel1: () => null,
    HueSlider: () => null,
  }
})
jest.mock('#/view/com/util/UserAvatar', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {View} = rn
  return {
    UserAvatar: ({
      profileShape,
      decoration,
    }: {
      profileShape?: string
      decoration?: {id: string}
    }) =>
      h(View, {
        testID: 'previewAvatar',
        accessibilityLabel: `${profileShape ?? 'default'} ${decoration?.id ?? 'none'}`,
      }),
  }
})
jest.mock('#/components/Button', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {Pressable} = rn
  return {
    Button: ({
      testID,
      label,
      onPress,
      disabled,
      children,
      accessibilityState,
    }: {
      testID?: string
      label: string
      onPress?: () => void
      disabled?: boolean
      children?: React.ReactNode
      accessibilityState?: {selected?: boolean}
    }) =>
      h(
        Pressable,
        {
          testID,
          accessibilityLabel: label,
          accessibilityState,
          disabled,
          onPress,
        },
        children,
      ),
    ButtonText: ({children}: {children?: React.ReactNode}) =>
      h(Pressable, null, children),
  }
})
jest.mock('#/platform/ui-text-view', () => {
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {UITextView: rn.Text}
})
jest.mock('#/components/Typography', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {
    Text: ({children, ...rest}: {children?: React.ReactNode}) =>
      react.createElement(rn.Text, rest, children),
  }
})
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Pressable', () => {
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {Pressable: rn.Pressable}
})
jest.mock('#/components/forms/Toggle', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {Pressable} = rn
  return {
    Item: ({
      label,
      value,
      onChange,
      disabled,
      children,
    }: {
      label: string
      value?: boolean
      onChange?: (value: boolean) => void
      disabled?: boolean
      children?: React.ReactNode
    }) =>
      h(
        Pressable,
        {
          accessibilityLabel: label,
          accessibilityState: {checked: !!value, disabled: !!disabled},
          disabled,
          onPress: () => onChange?.(!value),
        },
        children,
      ),
    LabelText: ({children}: {children?: React.ReactNode}) => children ?? null,
    Platform: () => null,
  }
})
jest.mock('expo-linear-gradient', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {View} = rn
  return {
    /*
     * Android's android.graphics.LinearGradient throws on fewer than two
     * colors ("needs >= 2 number of colors"), so the mock does too: a swatch
     * that hands it a single stop must fail here rather than on a device.
     */
    LinearGradient: (props: Record<string, unknown>) => {
      const colors = props.colors as string[]
      if (colors.length < 2) {
        throw new Error('needs >= 2 number of colors')
      }
      return h(View, props)
    },
  }
})
/*
 * The editor imports its hooks from sibling modules rather than the feature
 * barrel, so mocking the barrel would not reach them.
 */
jest.mock('../useDecorations', () => ({
  useAnimatedAvatarBlob: () => undefined,
  useAnimatedAvatar: () => undefined,
}))
jest.mock('../nameFonts', () => ({
  useNameFontAlias: () => undefined,
  useNameFontPreviewAlias: () => undefined,
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({selection: jest.fn(), tap: jest.fn()}),
}))

/**
 * Stand-in for the host that owns the draft (the edit-profile dialog): it
 * applies each edit and exposes a Save that resolves the draft to a patch, so
 * the assertions read the same record the writer would receive.
 */
function Harness({saved = {}}: {saved?: DecorationSettings}) {
  const [draft, setDraft] = useState(() => draftFromSaved(saved))
  return (
    <>
      <DecorationsEditor
        saved={saved}
        draft={draft}
        onEdit={patch =>
          setDraft(current => applyDraftEdit(current, saved, patch))
        }
        avatar="https://example.com/a.jpg"
        displayName="Test Person"
        handle="test.bsky.social"
      />
      <Text
        testID="saveDecorations"
        onPress={() => mockSave(draftToPatch(draft, saved))}>
        Save
      </Text>
    </>
  )
}

function renderEditor(saved: DecorationSettings = {}) {
  return render(
    <I18nProvider i18n={i18n}>
      <Harness saved={saved} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  mockSave.mockReset()
})

it('saves the picked frame, shape, gradient, and outline together', () => {
  const {getByTestId, getByLabelText} = renderEditor()

  fireEvent.press(getByLabelText('Flame'))
  fireEvent.press(getByLabelText('Hexagon'))
  fireEvent.press(getByLabelText('Sunset'))
  fireEvent.press(getByTestId('saveDecorations'))

  expect(mockSave).toHaveBeenCalledTimes(1)
  expect(mockSave).toHaveBeenCalledWith({
    avatar: 'flame-ring',
    avatarShape: 'hexagon',
    name: 'sunset',
    nameOutline: false,
  })
})

it('previews pending choices before they are saved', () => {
  const {getByTestId} = renderEditor()

  fireEvent.press(getByTestId('decoration-frame-ocean-ring'))
  fireEvent.press(getByTestId('avatar-shape-squircle'))

  expect(getByTestId('previewAvatar')).toHaveProp(
    'accessibilityLabel',
    'squircle ocean-ring',
  )
})

it('starts from the saved record and saves nothing until it changes', () => {
  const {getByTestId} = renderEditor({
    avatar: 'gold-ring',
    avatarShape: 'circle',
    name: 'rose',
    nameOutline: true,
  })

  expect(getByTestId('previewAvatar')).toHaveProp(
    'accessibilityLabel',
    'circle gold-ring',
  )
  fireEvent.press(getByTestId('saveDecorations'))
  expect(mockSave).toHaveBeenCalledTimes(1)
  // An untouched draft round-trips to the record it came from.
  expect(mockSave).toHaveBeenCalledWith({
    avatar: 'gold-ring',
    avatarShape: 'circle',
    name: 'rose',
    nameOutline: true,
  })
})

it('clears a slot by choosing None', () => {
  const {getByTestId} = renderEditor({
    avatar: 'gold-ring',
    name: 'rose',
  })

  fireEvent.press(getByTestId('decoration-frame-none'))
  fireEvent.press(getByTestId('decoration-gradient-none'))
  fireEvent.press(getByTestId('saveDecorations'))

  expect(mockSave).toHaveBeenCalledWith({
    avatar: undefined,
    name: undefined,
    avatarShape: undefined,
    nameOutline: false,
  })
})

it('stores an arbitrary frame color without a preset frame', () => {
  const {getByTestId} = renderEditor()

  fireEvent.press(getByTestId('decoration-frame-custom'))
  fireEvent.changeText(getByTestId('decoration-frame-color-hex'), '#123456')
  fireEvent.press(getByTestId('saveDecorations'))

  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({avatar: undefined, avatarColor: '#123456'}),
  )
})

it('stores an arbitrary solid name color and drops the preset', () => {
  const {getByTestId} = renderEditor({name: 'rose'})

  fireEvent.press(getByTestId('decoration-gradient-custom'))
  fireEvent.changeText(getByTestId('decoration-name-color-hex'), '#00ff88')
  fireEvent.press(getByTestId('saveDecorations'))

  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: undefined,
      nameColor: '#00ff88',
      nameGradient: undefined,
    }),
  )
})

it('stores a custom 3-stop gradient and never keeps a second paint', () => {
  const {getByTestId, getByLabelText} = renderEditor()

  fireEvent.press(getByTestId('decoration-gradient-custom'))
  fireEvent.press(getByLabelText('Gradient'))
  fireEvent.press(getByLabelText('Three colors'))
  fireEvent.press(getByLabelText('Hard edges'))
  fireEvent.press(getByTestId('saveDecorations'))

  const [patch] = mockSave.mock.calls[0]
  expect(patch.nameColor).toBeUndefined()
  expect(patch.name).toBeUndefined()
  expect(patch.nameGradient).toEqual({
    colors: ['#7c3aed', '#28acdc', '#f2571f'],
    hard: true,
  })
})
