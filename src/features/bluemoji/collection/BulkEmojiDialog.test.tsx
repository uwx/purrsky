import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native'

import {type EmojiDraft} from '#/features/bluemoji/collection/mutations'
import {BulkEmojiDialogForm, type BulkPackDraft} from './BulkEmojiDialog'

type Listener = (
  drafts: EmojiDraft[],
  onProgress: (done: number) => void,
  pack?: BulkPackDraft,
) => void

jest.mock('#/components/Dialog', () => {
  const {View} = jest.requireActual('react-native') as {
    View: React.ComponentType<{children?: React.ReactNode}>
  }
  return {
    ScrollableInner: ({children}: {children: React.ReactNode}) => (
      <View>{children}</View>
    ),
    Close: () => null,
  }
})
jest.mock('#/lib/media/picker', () => ({
  openMultiplePicker: jest.fn(() =>
    Promise.resolve([
      {path: '/tmp/one.png', mime: 'image/png', fileName: 'one.png'},
      {path: '/tmp/two.png', mime: 'image/png', fileName: 'two.png'},
    ]),
  ),
}))
jest.mock('#/lib/media/manip', () => ({
  compressIfNeeded: (image: unknown) => Promise.resolve(image),
}))
// The real Typography module pulls in a native-only text view the test renderer
// cannot load; plain RN Text behaves the same for these assertions.
jest.mock('#/components/Typography', () => {
  const {Text} = jest.requireActual('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>
  }
  return {Text, P: Text, H1: Text, H2: Text}
})

function setup(onSave: Listener = jest.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <BulkEmojiDialogForm isPending={false} onSave={onSave} />
    </I18nProvider>,
  )
  return onSave as jest.Mock<void, Parameters<Listener>> & Listener
}

/** Picks the mocked two-image selection, which fills both alias rows. */
async function pickImages() {
  fireEvent.press(screen.getByLabelText('Choose images'))
  await screen.findByDisplayValue('one')
}

function addButton() {
  return screen.getByLabelText('Add emoji')
}

it('hides the pack fields until asked for them', async () => {
  setup()
  await pickImages()

  expect(screen.queryByLabelText('Pack name')).toBeNull()
  fireEvent.press(screen.getByLabelText('Also save as a pack'))
  expect(screen.getByLabelText('Pack name')).toBeTruthy()
  expect(screen.getByLabelText('Pack description')).toBeTruthy()
})

it('will not save until the pack has a name', async () => {
  setup()
  await pickImages()
  fireEvent.press(screen.getByLabelText('Also save as a pack'))

  expect(addButton()).toBeDisabled()

  fireEvent.changeText(screen.getByLabelText('Pack name'), 'cute cats')
  await waitFor(() => expect(addButton()).toBeEnabled())
})

it('hands the emoji and the pack to the mutation together', async () => {
  const onSave = setup()
  await pickImages()
  fireEvent.press(screen.getByLabelText('Also save as a pack'))
  fireEvent.changeText(screen.getByLabelText('Pack name'), ' cute cats ')
  fireEvent.changeText(screen.getByLabelText('Pack description'), 'all of them')
  fireEvent.press(addButton())

  await waitFor(() => expect(onSave).toHaveBeenCalled())
  const [drafts, , pack] = onSave.mock.calls[0]
  expect(drafts.map(draft => draft.alias)).toEqual(['one', 'two'])
  expect(pack).toEqual({name: 'cute cats', description: 'all of them'})
})

it('saves without a pack when the option is left alone', async () => {
  const onSave = setup()
  await pickImages()
  fireEvent.press(addButton())

  await waitFor(() => expect(onSave).toHaveBeenCalled())
  expect(onSave.mock.calls[0][2]).toBeUndefined()
})

it('refuses a pack name that is too long in bytes, not characters', async () => {
  setup()
  await pickImages()
  fireEvent.press(screen.getByLabelText('Also save as a pack'))
  /*
   * 32 emoji are only 32 characters but 128 bytes, so the input's own
   * maxLength cannot catch this; the byte check has to.
   */
  fireEvent.changeText(screen.getByLabelText('Pack name'), '😀'.repeat(32))

  expect(addButton()).toBeDisabled()
  expect(screen.getByText(/limited to 64/)).toBeTruthy()
})
