/** @jest-environment jsdom */

import {act, useState} from 'react'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

import {hexToOklch, oklchToHex} from '#/features/avatarDecorations/oklch'
import {DecorationColorField} from './index.web'

jest.mock('react-native', () => jest.requireActual('react-native-web'))

/*
 * Every atom resolves to a plain style so the picker's CSS-variable bridge has
 * something to write; only the shape matters here.
 */
const mockStyled = () => ({
  backgroundColor: '#ffffff',
  borderColor: '#cccccc',
  color: '#000000',
})
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: mockStyled}),
  useTheme: () => ({
    atoms: new Proxy({}, {get: mockStyled}),
    palette: {primary_500: '#0085ff'},
  }),
}))
jest.mock('#/components/Typography', () => {
  const rn: typeof import('react-native') =
    jest.requireActual('react-native-web')
  return {Text: rn.Text}
})
jest.mock('#/components/Button', () => {
  const react: typeof import('react') = jest.requireActual('react')
  return {
    Button: ({label, onPress}: {label: string; onPress: () => void}) =>
      react.createElement('button', {type: 'button', onClick: onPress}, label),
    ButtonText: ({children}: React.PropsWithChildren) =>
      react.createElement('span', null, children),
  }
})
jest.mock('#/components/forms/TextField', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {TextInput, View} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {
    Root: ({children}: React.PropsWithChildren) =>
      react.createElement(View, null, children),
    Input: (props: {onChangeText: (text: string) => void}) =>
      react.createElement(TextInput, props),
  }
})

interface MockControl {
  readonly isOpen: boolean
  readonly open: () => void
  readonly close: () => void
}

jest.mock('#/components/Dialog', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {createContext, createElement: h, useContext, useState} = react
  const Context = createContext<MockControl>({
    isOpen: false,
    open: () => {},
    close: () => {},
  })
  return {
    useDialogControl: (): MockControl => {
      const [isOpen, setOpen] = useState(false)
      return {
        isOpen,
        open: () => setOpen(true),
        close: () => setOpen(false),
      }
    },
    useDialogContext: () => useContext(Context),
    Outer: ({
      control,
      children,
    }: {
      control: MockControl
      children?: React.ReactNode
    }) =>
      control.isOpen
        ? h(Context.Provider, {value: control}, h('div', null, children))
        : null,
    Close: () => null,
    ScrollableInner: ({children}: React.PropsWithChildren) =>
      h('div', null, children),
  }
})

/*
 * The real picker paints its channel sliders with WebGL2 and is replaced with a
 * stub speaking the same contract: it is handed the opening color and can push
 * a new one. The OKLCH conversion underneath stays real.
 */
const mockSupportsPicker = {current: true}
jest.mock('./canvasSupport', () => ({
  supportsCanvasPicker: () => mockSupportsPicker.current,
}))
jest.mock('@terrazzo/react-color-picker', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {createElement: h} = react
  return {
    __esModule: true,
    default: ({
      color,
      setColor,
    }: {
      color: {css: string}
      setColor: (value: string) => void
    }) =>
      h(
        'div',
        null,
        h('output', {'data-testid': 'picker-color'}, color.css),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'picker-emit',
            onClick: () => setColor('oklch(0.7 0.2 150)'),
          },
          'pick',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'picker-emit-partial',
            onClick: () => setColor('oklch(0.7'),
          },
          'partial',
        ),
      ),
  }
})

/*
 * Stand-in for `@terrazzo/use-color` built on the feature's own conversions, so
 * the test exercises the field's wiring without the color-library bundle.
 */
interface MockColor {
  readonly css: string
  readonly oklch: {readonly coords: Array<number | null>}
}
jest.mock('@terrazzo/use-color', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const {useState} = react
  const oklch: typeof import('#/features/avatarDecorations/oklch') =
    jest.requireActual('#/features/avatarDecorations/oklch')

  function toColor(css: string): MockColor {
    const match = /^oklch\(([^)]+)\)$/.exec(css.trim())
    if (match) {
      const [l, c, h] = match[1].trim().split(/\s+/).map(Number)
      return {css, oklch: {coords: [l, c, h]}}
    }
    const color = oklch.hexToOklch(css)
    if (!color) throw new Error(`cannot parse ${css}`)
    return {css, oklch: {coords: [color.l, color.c, color.h]}}
  }

  /*
   * Named `useColor` so the mock reads as the hook it replaces; the state is
   * keyed on the opening string, exactly like the real one.
   */
  function useColor(initial: string) {
    /*
     * React Compiler compiles hooks by name and hoists its memo-cache helper to
     * module scope, which a `jest.mock` factory may not reference. Opting out
     * keeps the factory self-contained.
     */
    'use no memo'
    const [css, setCss] = useState(initial)
    const setColor = (next: string | ((previous: string) => string)) => {
      setCss(previous => (typeof next === 'function' ? next(previous) : next))
    }
    return [toColor(css), setColor]
  }

  return {__esModule: true, parse: toColor, default: useColor}
})

const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function render(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    createRoot(container).render(
      <I18nProvider i18n={i18n}>{node}</I18nProvider>,
    )
  })
  return container
}

function press(container: HTMLElement, testID: string) {
  const element = container.querySelector<HTMLElement>(
    `[data-testid="${testID}"]`,
  )
  if (!element) throw new Error(`no ${testID}`)
  act(() => {
    element.click()
  })
}

function pressDone(container: HTMLElement) {
  const button = [...container.querySelectorAll('button')].find(
    element => element.textContent === 'Done',
  )
  if (!button) throw new Error('no Done button')
  act(() => {
    button.click()
  })
}

function pickerColor(container: HTMLElement) {
  return container.querySelector('[data-testid="picker-color"]')?.textContent
}

function colorInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type=color]')
  if (!input) throw new Error('no color input rendered')
  return input
}

/** Expected opening color, in the exact string form the field derives. */
function storedAsOklch(hex: string) {
  const color = hexToOklch(hex)
  return `oklch(${color?.l} ${color?.c} ${color?.h})`
}

/** Field wired the way the screen uses it: edits round-trip through state. */
function Field() {
  const [value, setValue] = useState('#112233')
  return (
    <DecorationColorField
      label="Name color"
      value={value}
      onChange={setValue}
      testID="field"
    />
  )
}

describe('with the OKLCH picker', () => {
  beforeEach(() => {
    mockSupportsPicker.current = true
  })

  it('opens the picker at the stored color, in OKLCH', () => {
    const container = render(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={() => {}}
        testID="field"
      />,
    )

    press(container, 'field-swatch')

    expect(pickerColor(container)).toBe(storedAsOklch('#112233'))
  })

  it('stores the picker color gamut-mapped to sRGB', () => {
    const onChange = jest.fn()
    const container = render(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={onChange}
        testID="field"
      />,
    )

    press(container, 'field-swatch')
    press(container, 'picker-emit')

    expect(onChange).toHaveBeenCalledWith(oklchToHex({l: 0.7, c: 0.2, h: 150}))
  })

  it('ignores a half-typed color from the picker code box', () => {
    const onChange = jest.fn()
    const container = render(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={onChange}
        testID="field"
      />,
    )

    press(container, 'field-swatch')
    press(container, 'picker-emit-partial')

    expect(onChange).not.toHaveBeenCalled()
  })

  /*
   * The picker is mounted once per open at the stored color. Feeding its own
   * output back as `value` would move the sliders under the pointer mid-drag,
   * and a reopen must still start from what the record kept.
   */
  it('does not reset the picker to the stored color mid-drag', () => {
    const container = render(<Field />)

    press(container, 'field-swatch')
    press(container, 'picker-emit')
    expect(pickerColor(container)).toBe('oklch(0.7 0.2 150)')

    pressDone(container)
    press(container, 'field-swatch')
    expect(pickerColor(container)).toBe(
      storedAsOklch(oklchToHex({l: 0.7, c: 0.2, h: 150})),
    )
  })
})

describe('without WebGL2', () => {
  beforeEach(() => {
    mockSupportsPicker.current = false
  })

  it('opens the browser picker over the swatch at the stored color', () => {
    const container = render(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={() => {}}
        testID="field"
      />,
    )

    const input = colorInput(container)
    expect(input.value).toBe('#112233')
    expect(input.getAttribute('data-testid')).toBe('field-swatch')
    expect(input.getAttribute('aria-label')).toBe('Name color')
  })

  it('stores what the browser picker returns, normalized', () => {
    const onChange = jest.fn()
    const container = render(
      <DecorationColorField
        label="Name color"
        value="#112233"
        onChange={onChange}
        testID="field"
      />,
    )

    const input = colorInput(container)
    /*
     * React tracks the last value it rendered and drops an `input` event when
     * the property already matches it, so drive the native setter like a real
     * picker.
     */
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    act(() => {
      setValue?.call(input, '#aabbcc')
      input.dispatchEvent(new Event('input', {bubbles: true}))
    })

    expect(onChange).toHaveBeenCalledWith('#aabbcc')
  })
})
