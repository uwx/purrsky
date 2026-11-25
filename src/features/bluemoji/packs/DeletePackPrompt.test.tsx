import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, fireEvent, render, screen} from '@testing-library/react-native'

import {DeletePackPrompt} from './DeletePackPrompt'
import {type BluemojiPack, PACK_COLLECTION} from './util'

type DeleteOptions = {
  onProgress?: (done: number, total: number) => void
  onSuccess?: () => void
  onError?: () => void
}

const mockDelete = jest.fn<void, [unknown, DeleteOptions]>()

jest.mock('./mutations', () => ({
  useDeletePackMutation: () => ({mutate: mockDelete, isPending: false}),
}))
// The real Typography module pulls in a native-only text view the test renderer
// cannot load; plain RN Text behaves the same for these assertions.
jest.mock('#/components/Typography', () => {
  const {Text} = jest.requireActual('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>
  }
  return {Text, P: Text, H1: Text, H2: Text}
})
jest.mock('#/components/Prompt', () =>
  jest.requireActual('#/features/bluemoji/packs/__fixtures__/fakePrompt'),
)
// The progress dialog only has to be open or closed here, and whether it was
// built to refuse dismissal.
jest.mock('#/components/Dialog', () => {
  const {useState} = jest.requireActual('react') as {
    useState: <T>(initial: T) => [T, (value: T) => void]
  }
  const {View} = jest.requireActual('react-native') as {
    View: React.ComponentType<{
      testID?: string
      children?: React.ReactNode
    }>
  }
  return {
    useDialogControl: () => {
      const [isOpen, setIsOpen] = useState(false)
      return {
        id: 'dialog',
        ref: {current: null},
        isOpen,
        open: () => setIsOpen(true),
        close: (cb?: () => void) => {
          setIsOpen(false)
          cb?.()
        },
      }
    },
    Outer: ({
      control,
      preventDismiss,
      children,
    }: {
      control: {isOpen: boolean}
      preventDismiss?: boolean
      children?: React.ReactNode
    }) =>
      control.isOpen ? (
        <View testID={preventDismiss ? 'blockingDialog' : 'dialog'}>
          {children}
        </View>
      ) : null,
    ScrollableInner: ({children}: {children?: React.ReactNode}) => (
      <View>{children}</View>
    ),
  }
})

const pack = {
  uri: 'at://did:plc:me/blue.moji.packs.pack/3kpack',
  cid: 'bafypack',
  did: 'did:plc:me',
  pdsUrl: 'https://pds.example',
  record: {
    $type: PACK_COLLECTION,
    name: 'cats',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
} as BluemojiPack

function renderPrompt({
  emojiCount,
  onDeleted,
}: {emojiCount?: number; onDeleted?: () => void} = {}) {
  const control = {
    id: 'prompt',
    ref: {current: null},
    isOpen: true,
    open: jest.fn(),
    close: jest.fn(),
  }
  render(
    <I18nProvider i18n={i18n}>
      <DeletePackPrompt
        control={control}
        pack={pack}
        emojiCount={emojiCount}
        onDeleted={onDeleted}
      />
    </I18nProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

it('deletes the pack alone when the option is left off', () => {
  renderPrompt({emojiCount: 3})

  fireEvent.press(screen.getByLabelText('Delete pack'))

  expect(mockDelete).toHaveBeenCalledTimes(1)
  expect(mockDelete.mock.calls[0][0]).toMatchObject({
    pack,
    deleteItems: false,
  })
  // No second confirmation: nothing beyond the pack is destroyed.
  expect(screen.queryByText('Delete the emoji too?')).toBeNull()
})

it('asks a second time before deleting the emoji', () => {
  renderPrompt({emojiCount: 3})

  fireEvent.press(screen.getByLabelText('Also delete the emoji in this pack'))
  fireEvent.press(screen.getByLabelText('Delete pack'))

  expect(mockDelete).not.toHaveBeenCalled()
  expect(screen.getByText('Delete the emoji too?')).toBeTruthy()

  fireEvent.press(screen.getByLabelText('Delete emoji and pack'))
  expect(mockDelete.mock.calls[0][0]).toMatchObject({
    pack,
    deleteItems: true,
  })
})

it('hides the option when the pack has no emoji to delete', () => {
  renderPrompt({emojiCount: 0})

  expect(
    screen.queryByLabelText('Also delete the emoji in this pack'),
  ).toBeNull()
  fireEvent.press(screen.getByLabelText('Delete pack'))
  expect(mockDelete.mock.calls[0][0]).toMatchObject({
    pack,
    deleteItems: false,
  })
})

it('shows progress in a dialog that cannot be dismissed until it finishes', () => {
  const onDeleted = jest.fn()
  renderPrompt({emojiCount: 3, onDeleted})

  fireEvent.press(screen.getByLabelText('Delete pack'))

  expect(screen.getByTestId('blockingDialog')).toBeTruthy()
  expect(screen.getByText('Deleting cats…')).toBeTruthy()

  const variables = mockDelete.mock.calls[0][0] as {
    onProgress?: (done: number, total: number) => void
  }
  act(() => variables.onProgress?.(1, 4))
  expect(screen.getByText('1 of 4…')).toBeTruthy()

  act(() => variables.onProgress?.(4, 4))
  expect(screen.getByText('4 of 4…')).toBeTruthy()
  // Still up, and the caller's cleanup has not run yet.
  expect(screen.getByTestId('blockingDialog')).toBeTruthy()
  expect(onDeleted).not.toHaveBeenCalled()

  act(() => mockDelete.mock.calls[0][1].onSuccess?.())
  expect(screen.queryByTestId('blockingDialog')).toBeNull()
  expect(onDeleted).toHaveBeenCalledTimes(1)
})

it('closes the progress dialog when the delete fails', () => {
  renderPrompt({emojiCount: 3})

  fireEvent.press(screen.getByLabelText('Delete pack'))
  expect(screen.getByTestId('blockingDialog')).toBeTruthy()

  act(() => mockDelete.mock.calls[0][1].onError?.())
  expect(screen.queryByTestId('blockingDialog')).toBeNull()
})
