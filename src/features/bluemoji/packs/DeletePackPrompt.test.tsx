import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render, screen} from '@testing-library/react-native'

import {DeletePackPrompt} from './DeletePackPrompt'
import {type BluemojiPack, PACK_COLLECTION} from './util'

const mockDelete = jest.fn<void, [unknown, {onSuccess?: () => void}]>()

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

function renderPrompt({emojiCount}: {emojiCount?: number} = {}) {
  const control = {
    id: 'prompt',
    ref: {current: null},
    isOpen: true,
    open: jest.fn(),
    close: jest.fn(),
  }
  render(
    <I18nProvider i18n={i18n}>
      <DeletePackPrompt control={control} pack={pack} emojiCount={emojiCount} />
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
  expect(mockDelete.mock.calls[0][0]).toEqual({pack, deleteItems: false})
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
  expect(mockDelete.mock.calls[0][0]).toEqual({pack, deleteItems: true})
})

it('hides the option when the pack has no emoji to delete', () => {
  renderPrompt({emojiCount: 0})

  expect(
    screen.queryByLabelText('Also delete the emoji in this pack'),
  ).toBeNull()
  fireEvent.press(screen.getByLabelText('Delete pack'))
  expect(mockDelete.mock.calls[0][0]).toEqual({pack, deleteItems: false})
})
