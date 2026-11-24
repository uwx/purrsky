import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {fireEvent, render} from '@testing-library/react-native'

import {EditProfileDialog} from './EditProfileDialog'

const mockClose = jest.fn<void, [(() => void)?]>()
const mockNavigate = jest.fn()
const mockSaveDecorations = jest.fn<
  Promise<{next: Record<string, unknown>}>,
  [{draft: Record<string, unknown>; saved: Record<string, unknown>}]
>()

jest.mock('@lingui/react/macro', () => {
  const actual = jest.requireActual('@lingui/react/macro')
  return {
    ...actual,
    Trans: ({children}: {children: React.ReactNode}) => children,
    Plural: () => null,
    useLingui: () => ({
      i18n: {
        _: (d: {message?: string}) => d.message ?? '',
        date: () => '',
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
jest.mock('#/Navigation', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}))
jest.mock('#/components/Dialog', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const Pass = ({children}: {children?: React.ReactNode}) =>
    h(rn.View, null, children)
  return {
    useDialogControl: () => ({open: jest.fn(), close: jest.fn()}),
    useDialogContext: () => ({
      close: mockClose,
      disableDrag: false,
      setDisableDrag: jest.fn(),
    }),
    Outer: Pass,
    Handle: () => null,
    Close: () => null,
    ScrollableInner: ({
      children,
      header,
    }: {
      children?: React.ReactNode
      header?: React.ReactNode
    }) => h(rn.View, null, header, children),
    Header: Pass,
    HeaderText: Pass,
    Input: ({
      testID,
      onChangeText,
    }: {
      testID?: string
      onChangeText?: (text: string) => void
    }) => h(rn.TextInput, {testID, onChangeText}),
  }
})
jest.mock('#/components/Prompt', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h} = react
  const Pass = ({children}: {children?: React.ReactNode}) =>
    h(rn.View, null, children)
  return {
    Basic: ({onConfirm}: {onConfirm: () => void}) =>
      h(
        rn.Pressable,
        {testID: 'probeConfirmDiscard', onPress: () => onConfirm()},
        h(rn.Text, null, 'confirm'),
      ),
    Outer: Pass,
    Content: Pass,
    Actions: Pass,
    TitleText: Pass,
    DescriptionText: Pass,
  }
})
jest.mock('#/components/Typography', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const text = ({children, ...rest}: {children?: React.ReactNode}) =>
    react.createElement(rn.Text, rest, children)
  return {Text: text, H1: text, H2: text, P: text}
})
jest.mock('#/components/Link', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {
    InlineLinkText: ({children}: {children?: React.ReactNode}) =>
      react.createElement(rn.Text, null, children),
    Link: ({children}: {children?: React.ReactNode}) =>
      react.createElement(rn.View, null, children),
  }
})
jest.mock('#/components/Admonition', () => ({
  Admonition: () => null,
}))
jest.mock('#/components/Toast', () => ({
  show: jest.fn(),
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({tap: jest.fn(), selection: jest.fn()}),
  ImpactFeedbackStyle: {},
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: jest.fn(), error: jest.fn()}),
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileUpdateMutation: () => ({
    mutateAsync: jest.fn(),
    error: undefined,
    isError: false,
    isPending: false,
  }),
}))
jest.mock('#/components/verification', () => ({
  useSimpleVerificationStateWithDeer: () => ({isVerified: false}),
}))
jest.mock('#/features/profileLinks', () => ({
  useCanEditProfileLinks: () => false,
  useOwnProfileLinksQuery: () => ({data: undefined}),
  useWriteProfileLinks: () => jest.fn(),
  useSetOwnProfileLinksCache: () => jest.fn(),
  sameProfileLinks: () => true,
}))
jest.mock('#/features/avatarDecorations', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const draft = jest.requireActual('#/features/avatarDecorations/draft')
  return {
    ...draft,
    DecorationsEditor: ({
      onEdit,
    }: {
      onEdit: (patch: Record<string, unknown>) => void
    }) =>
      react.createElement(
        rn.Pressable,
        {
          testID: 'probeEditDecorations',
          onPress: () => onEdit({avatar: 'rainbow'}),
        },
        react.createElement(rn.View, null),
      ),
    useAvatarShape: () => undefined,
    useAvatarDecoration: () => undefined,
    useMyDecorationSettingsQuery: () => ({
      data: {},
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    }),
    useSaveDecorations: () => ({
      mutateAsync: mockSaveDecorations,
      isPending: false,
    }),
  }
})
jest.mock('#/view/com/util/UserAvatar', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {
    UserAvatar: () => react.createElement(rn.View, null),
    EditableUserAvatar: () => react.createElement(rn.View, null),
    getSquareAvatarRadius: () => 8,
    resolveAvatarShape: () => ({shape: 'circle', radius: 8, hexagon: false}),
  }
})
jest.mock('#/view/com/util/UserBanner', () => ({
  UserBanner: () => null,
}))
jest.mock('#/view/icons/Logo', () => ({Logo: () => null}))
jest.mock('#/screens/Profile/Header/WitchHatEditor', () => ({
  WitchHatEditor: () => null,
}))

const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function control() {
  return {id: 'edit', ref: {current: null}, open: jest.fn(), close: mockClose}
}

function setup() {
  // Real dialogs run close callbacks after the close animation.
  mockClose.mockImplementation(cb => cb?.())
  const screen = render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>
        <EditProfileDialog
          profile={
            {
              did: 'did:plc:test',
              handle: 'test.bsky.social',
            } as never
          }
          control={control() as never}
        />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return screen
}

afterEach(() => {
  jest.clearAllMocks()
})

it('edits decorations inline instead of linking to a settings screen', () => {
  const screen = setup()
  expect(screen.getByTestId('probeEditDecorations')).toBeTruthy()
  expect(screen.queryByTestId('editProfileDecorationsLink')).toBeNull()
  expect(screen.getByTestId('editProfileAccountSettingsLink')).toBeTruthy()
})

it('asks before discarding edits, then navigates', () => {
  const screen = setup()
  fireEvent.changeText(
    screen.getByTestId('editProfileDisplayNameInput'),
    'New name',
  )
  fireEvent.press(screen.getByTestId('editProfileAccountSettingsLink'))
  // Prompt is open; the dialog has not closed yet.
  expect(mockClose).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('probeConfirmDiscard'))
  expect(mockClose).toHaveBeenCalledTimes(1)
  expect(mockNavigate).toHaveBeenCalledWith({
    name: 'AccountSettings',
    params: undefined,
  })
})

it('navigates to account settings after the dialog closes', () => {
  const screen = setup()
  fireEvent.press(screen.getByTestId('editProfileAccountSettingsLink'))
  expect(mockNavigate).toHaveBeenCalledWith({
    name: 'AccountSettings',
    params: undefined,
  })
})

it('writes a decoration draft when the profile is saved', () => {
  mockSaveDecorations.mockResolvedValue({next: {avatar: 'rainbow'}})
  const screen = setup()
  fireEvent.press(screen.getByTestId('probeEditDecorations'))
  fireEvent.press(screen.getByTestId('editProfileSaveBtn'))
  expect(mockSaveDecorations).toHaveBeenCalledTimes(1)
  expect(mockSaveDecorations.mock.calls[0][0]).toEqual({
    draft: expect.objectContaining({
      avatar: 'rainbow',
      touched: true,
    }),
    saved: {},
  })
})
