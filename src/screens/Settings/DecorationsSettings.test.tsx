import {createElement} from 'react'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {DecorationsSettingsScreen} from './DecorationsSettings'

const i18n = setupI18n({locale: 'en', messages: {en: {}}})
const mockMutate = jest.fn<
  void,
  [Record<string, unknown>, {onSuccess?: (result: {next: unknown}) => void}?]
>()
const mockSettings = {
  data: {} as Record<string, unknown>,
  isLoading: false,
  isSuccess: true,
  isError: false,
  refetch: jest.fn(),
}

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
jest.mock('#/state/queries/useCurrentAccountProfile', () => ({
  useCurrentAccountProfile: () => ({
    did: 'did:plc:test',
    handle: 'test.bsky.social',
    displayName: 'Test Person',
    avatar: 'https://example.com/a.jpg',
  }),
}))
jest.mock('#/features/avatarDecorations', () => {
  const shapes: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/avatarShapes',
  )
  const catalog: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/catalog',
  )
  const draft: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/draft',
  )
  const gradients: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/nameGradients',
  )
  const oklch: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/oklch',
  )
  const paint: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/namePaint',
  )
  const googleFonts: Record<string, unknown> = jest.requireActual(
    '#/features/avatarDecorations/googleFonts',
  )
  return {
    ...shapes,
    ...catalog,
    ...draft,
    ...gradients,
    ...oklch,
    ...paint,
    ...googleFonts,
    DecorationsEditor: (
      jest.requireActual<{
        DecorationsEditor: React.ComponentType
      }>('#/features/avatarDecorations/editor/DecorationsEditor')
    ).DecorationsEditor,
    nameGradientTextStyle: () => ({}),
    useNameFontAlias: () => undefined,
    useNameFontPreviewAlias: () => undefined,
    useAnimatedAvatarBlob: () => undefined,
    useMyDecorationSettingsQuery: () => mockSettings,
    useSaveDecorations: () => ({
      mutate: (
        vars: {draft: unknown; saved: Record<string, unknown>},
        options?: {onSuccess?: (result: {next: unknown}) => void},
      ) => {
        const toPatch = draft.draftToPatch as (...args: unknown[]) => Record<
          string,
          unknown
        >
        mockMutate(toPatch(vars.draft, vars.saved), options)
      },
      isPending: false,
    }),
  }
})
/*
 * The editor imports its hooks from sibling modules rather than the feature
 * barrel, so the barrel mock above does not reach them.
 */
jest.mock('#/features/avatarDecorations/useDecorations', () => ({
  useAnimatedAvatarBlob: () => undefined,
  useAnimatedAvatar: () => undefined,
}))
jest.mock('#/features/avatarDecorations/nameFonts', () => ({
  useNameFontAlias: () => undefined,
  useNameFontPreviewAlias: () => undefined,
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({selection: jest.fn(), tap: jest.fn()}),
}))
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
jest.mock('#/components/Layout', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {View} = rn
  const Pass = ({children}: {children?: React.ReactNode}) =>
    h(View, null, children)
  return {
    Screen: Pass,
    Content: Pass,
    Header: {
      Outer: Pass,
      BackButton: () => null,
      Content: Pass,
      TitleText: Pass,
      Slot: () => null,
    },
  }
})
jest.mock('#/screens/Settings/components/SettingsList', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const {View} = rn
  const Pass = ({children}: {children?: React.ReactNode}) =>
    h(View, null, children)
  return {
    Container: Pass,
    Group: Pass,
    Divider: () => null,
    ItemText: Pass,
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
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {Text: rn.Text}
})
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Admonition', () => ({
  Admonition: ({children}: {children: React.ReactNode}) => children,
}))
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
    LinearGradient: (props: Record<string, unknown>) => h(View, props),
  }
})

function renderScreen() {
  return render(
    createElement(
      I18nProvider,
      {i18n},
      createElement(DecorationsSettingsScreen, {
        navigation: {} as never,
        route: {} as never,
      }),
    ),
  )
}

beforeEach(() => {
  mockMutate.mockReset()
  mockSettings.data = {}
})

it('saves the picked frame, shape, gradient, and outline together', () => {
  const {getByLabelText} = renderScreen()

  fireEvent.press(getByLabelText('Flame'))
  fireEvent.press(getByLabelText('Hexagon'))
  fireEvent.press(getByLabelText('Sunset'))
  fireEvent.press(getByLabelText('Save'))

  expect(mockMutate).toHaveBeenCalledTimes(1)
  expect(mockMutate).toHaveBeenCalledWith(
    {
      avatar: 'flame-ring',
      avatarShape: 'hexagon',
      name: 'sunset',
      nameOutline: false,
    },
    expect.anything(),
  )
})

it('previews pending choices before they are saved', () => {
  const {getByTestId} = renderScreen()

  fireEvent.press(getByTestId('decoration-frame-ocean-ring'))
  fireEvent.press(getByTestId('avatar-shape-squircle'))

  expect(getByTestId('previewAvatar')).toHaveProp(
    'accessibilityLabel',
    'squircle ocean-ring',
  )
})

it('starts from the saved record and saves nothing until it changes', () => {
  mockSettings.data = {
    avatar: 'gold-ring',
    avatarShape: 'circle',
    name: 'rose',
    nameOutline: true,
  }
  const {getByTestId, getByLabelText} = renderScreen()

  expect(getByTestId('previewAvatar')).toHaveProp(
    'accessibilityLabel',
    'circle gold-ring',
  )
  fireEvent.press(getByLabelText('Save'))
  expect(mockMutate).not.toHaveBeenCalled()
})

it('clears a slot by choosing None', () => {
  mockSettings.data = {avatar: 'gold-ring', name: 'rose'}
  const {getByLabelText, getByTestId} = renderScreen()

  fireEvent.press(getByTestId('decoration-frame-none'))
  fireEvent.press(getByTestId('decoration-gradient-none'))
  fireEvent.press(getByLabelText('Save'))

  expect(mockMutate).toHaveBeenCalledWith(
    {
      avatar: undefined,
      name: undefined,
      avatarShape: undefined,
      nameOutline: false,
    },
    expect.anything(),
  )
})

it('stores an arbitrary frame color without a preset frame', () => {
  const {getByTestId, getByLabelText} = renderScreen()

  fireEvent.press(getByTestId('decoration-frame-custom'))
  fireEvent.changeText(getByTestId('decoration-frame-color-hex'), '#123456')
  fireEvent.press(getByLabelText('Save'))

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({avatar: undefined, avatarColor: '#123456'}),
    expect.anything(),
  )
})

it('stores an arbitrary solid name color and drops the preset', () => {
  mockSettings.data = {name: 'rose'}
  const {getByTestId, getByLabelText} = renderScreen()

  fireEvent.press(getByTestId('decoration-gradient-custom'))
  fireEvent.changeText(getByTestId('decoration-name-color-hex'), '#00ff88')
  fireEvent.press(getByLabelText('Save'))

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: undefined,
      nameColor: '#00ff88',
      nameGradient: undefined,
    }),
    expect.anything(),
  )
})

it('stores a custom 3-stop gradient and never keeps a second paint', () => {
  const {getByTestId, getByLabelText} = renderScreen()

  fireEvent.press(getByTestId('decoration-gradient-custom'))
  fireEvent.press(getByLabelText('Gradient'))
  fireEvent.press(getByLabelText('Three colors'))
  fireEvent.press(getByLabelText('Hard edges'))
  fireEvent.press(getByLabelText('Save'))

  const [patch] = mockMutate.mock.calls[0]
  expect(patch.nameColor).toBeUndefined()
  expect(patch.name).toBeUndefined()
  expect(patch.nameGradient).toEqual({
    colors: ['#7c3aed', '#28acdc', '#f2571f'],
    hard: true,
  })
})
