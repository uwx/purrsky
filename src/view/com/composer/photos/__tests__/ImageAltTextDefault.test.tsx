import {fireEvent, render, screen, waitFor} from '@testing-library/react-native'

const mockGenerateLocal = jest.fn(() =>
  Promise.resolve('A red square on black.'),
)

jest.mock('@lingui/react', () => {
  const format = (
    message:
      {message?: string; values?: Record<string, string | number>} | string,
  ) => {
    if (typeof message === 'string') return message
    return (message.message ?? '').replace(/{(\w+)}/g, (_, key: string) =>
      String(message.values?.[key] ?? ''),
    )
  }
  return {
    useLingui: () => ({
      _: format,
      t: format,
      i18n: {number: (value: number) => String(value)},
    }),
    Trans: ({
      id,
      message,
      values,
    }: {
      id: string
      message?: string
      values?: Record<string, string | number>
    }) => format({message: message ?? id, values}),
    Plural: ({value, other}: {value: number; other: string}) =>
      other.replace('#', String(value)),
  }
})
jest.mock('#/lib/ai/local-alt-text/localAltText', () => ({
  generateLocalAltText: () => mockGenerateLocal(),
}))
jest.mock('#/lib/ai/generateAltText', () => ({
  generateAltText: jest.fn(),
  cleanGeneratedAltText: (text: string) => text,
}))
jest.mock('#/state/preferences/openrouter', () => ({
  useAltTextAiConfigured: () => false,
  useAltTextAiConfig: () => undefined,
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'default',
}))
jest.mock('#/components/Typography', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {Text, P: Text, H1: Text, H2: Text}
})
jest.mock('expo-image', () => {
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {Image: View}
})
jest.mock('expo-file-system/legacy', () => ({
  EncodingType: {Base64: 'base64'},
  readAsStringAsync: jest.fn(),
}))
jest.mock('#/components/Dialog', () => {
  const {TextInput} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    Outer: ({children}: {children: React.ReactNode}) => children,
    Handle: () => null,
    Close: () => null,
    ScrollableInner: ({children}: {children: React.ReactNode}) => children,
    Input: (props: Record<string, unknown>) => <TextInput {...props} />,
  }
})

import {Provider} from '#/state/preferences/local-alt-text'
import {ImageAltTextDialog} from '#/view/com/composer/photos/ImageAltTextDialog'

const image = {
  source: {path: 'blob:image', width: 800, height: 600},
  alt: '',
} as never

it('offers on-device generation on a fresh install with no provider', async () => {
  render(
    <Provider>
      <ImageAltTextDialog
        control={{open: jest.fn(), close: jest.fn()} as never}
        image={image}
        languages={['de']}
        onChange={() => {}}
      />
    </Provider>,
  )

  fireEvent.press(screen.getByText('Generate on this device'))

  await waitFor(() => {
    expect(screen.getByDisplayValue('A red square on black.')).toBeTruthy()
  })
})
