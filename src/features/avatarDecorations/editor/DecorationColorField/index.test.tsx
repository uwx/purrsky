import {type ReactNode, useState} from 'react'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {DecorationColorField} from './index'

jest.mock('#/components/Typography', () => {
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {Text: rn.Text}
})

/*
 * The picker itself is a gesture-driven native surface; these tests cover the
 * wiring around it (what it opens at, and what a move stores), not its maths.
 */
jest.mock('reanimated-color-picker', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h, Fragment} = react
  const {Pressable, Text, View} = rn
  return {
    __esModule: true,
    default: ({
      value,
      onChangeJS,
      children,
    }: {
      value?: string
      onChangeJS?: (color: {hex: string}) => void
      children?: React.ReactNode
    }) =>
      h(
        Fragment,
        null,
        h(Text, {testID: 'picker-value'}, value),
        h(
          Pressable,
          {
            testID: 'picker-emit',
            onPress: () => onChangeJS?.({hex: '#00FF88'}),
          },
          h(View, null),
        ),
        children,
      ),
    Panel1: () => null,
    HueSlider: () => null,
  }
})
jest.mock('#/components/Dialog', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  const {createElement: h, createContext, useContext, useState} = react
  const {View} = rn
  const ControlContext = createContext<{isOpen: boolean} | null>(null)
  return {
    useDialogControl: () => {
      const [isOpen, setOpen] = useState(false)
      return {
        isOpen,
        open: () => setOpen(true),
        close: () => setOpen(false),
      }
    },
    useDialogContext: () => useContext(ControlContext) ?? {close: () => {}},
    Outer: ({
      control,
      children,
    }: {
      control: {isOpen: boolean}
      children?: React.ReactNode
    }) =>
      control.isOpen
        ? h(ControlContext.Provider, {value: control}, h(View, null, children))
        : null,
    Handle: () => null,
    Close: () => null,
    ScrollableInner: ({children}: {children?: React.ReactNode}) =>
      h(View, null, children),
  }
})

const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function withI18n(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>
}

/** Field wired the way the screen uses it: edits round-trip through state. */
function Field({initial = '#112233'}: {initial?: string}) {
  const [value, setValue] = useState(initial)
  return (
    <DecorationColorField
      label="Name color"
      value={value}
      onChange={setValue}
      testID="field"
    />
  )
}

it('keeps shorthand hex in the box while storing the expanded color', () => {
  const {getByTestId} = render(withI18n(<Field />))

  fireEvent.changeText(getByTestId('field-hex'), '#123')

  // The field emitted #112233; rewriting the box would fight the typer.
  expect(getByTestId('field-hex')).toHaveProp('value', '#123')
})

it('adopts a color set outside the box', () => {
  const field = (value: string) => (
    <I18nProvider i18n={i18n}>
      <DecorationColorField
        label="Name color"
        value={value}
        onChange={() => {}}
        testID="field"
      />
    </I18nProvider>
  )
  const {getByTestId, rerender} = render(field('#112233'))

  rerender(field('#445566'))

  expect(getByTestId('field-hex')).toHaveProp('value', '#445566')
})

it('ignores text that is not a color yet', () => {
  const onChange = jest.fn()
  const {getByTestId} = render(
    withI18n(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={onChange}
        testID="field"
      />,
    ),
  )

  fireEvent.changeText(getByTestId('field-hex'), '#12')

  expect(onChange).not.toHaveBeenCalled()
  expect(getByTestId('field-hex')).toHaveProp('value', '#12')
})

it('stores what the picker returns, normalized', () => {
  const {getByTestId} = render(withI18n(<Field />))

  fireEvent.press(getByTestId('field-swatch'))
  fireEvent.press(getByTestId('picker-emit'))

  expect(getByTestId('field-hex')).toHaveProp('value', '#00ff88')
})

/*
 * The picker is mounted once per open at the stored color. Feeding its own
 * output back as `value` would move the thumb under the finger mid-drag.
 */
it('holds the picker at the color it opened with', () => {
  const {getByTestId, getByText} = render(withI18n(<Field />))

  fireEvent.press(getByTestId('field-swatch'))
  expect(getByTestId('picker-value')).toHaveProp('children', '#112233')

  fireEvent.press(getByTestId('picker-emit'))
  expect(getByTestId('picker-value')).toHaveProp('children', '#112233')

  fireEvent.press(getByText('Done'))
  fireEvent.press(getByTestId('field-swatch'))
  expect(getByTestId('picker-value')).toHaveProp('children', '#00ff88')
})
