/**
 * Web replacement for the native color picker.
 *
 * The native build uses `reanimated-color-picker`, which is gesture-driven and
 * imports react-native-gesture-handler; the web bundle refuses that module
 * outright (see `metro.config.ts`) and its worklets have no gesture runtime
 * here anyway. Instead the swatch opens `@terrazzo/react-color-picker`, an
 * OKLCH picker that paints its channel gradients with WebGL2 shaders - the
 * same color model the name gradients are stored in, so what the user adjusts
 * is what the record keeps.
 *
 * The picker owns Oklch, but the solid-color slots in the record are `#rrggbb`
 * (eurosky and tenna read them), so every change is converted through the
 * feature's own gamut mapping before it is emitted.
 *
 * Browsers without WebGL2 (and jsdom) fall back to the browser's own picker via
 * a transparent `<input type="color">`; the shader setup throws on mount, which
 * would otherwise take the whole settings screen down.
 */

import '@terrazzo/tokens/index.css'
import '@terrazzo/tiles/dist/all-components.css'
import '@terrazzo/react-color-picker/dist/styles.css'
import './colorSpaces'

import {type SetStateAction, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import ColorPicker from '@terrazzo/react-color-picker'
import useColor, {
  type ColorInput,
  type ColorOutput,
  parse,
} from '@terrazzo/use-color'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Pressable} from '#/components/Pressable'
import {Text} from '#/components/Typography'
import {
  hexToOklch,
  normalizeHex,
  oklchToHex,
} from '#/features/avatarDecorations/oklch'
import {supportsCanvasPicker} from './canvasSupport'
import {ColorFieldRow, FALLBACK_COLOR, SWATCH_SIZE, swatchStyle} from './shared'
import {useTerrazzoTheme} from './terrazzoTheme'

export function DecorationColorField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  testID?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const picker = Dialog.useDialogControl()
  const [openColor, setOpenColor] = useState(value)
  const [canvas] = useState(supportsCanvasPicker)

  /*
   * The picker opens at a frozen color. `value` changes on every drag frame and
   * feeding it back would move the sliders under the pointer; a reopen still
   * starts from what is stored because this is refreshed on each open.
   */
  const onOpen = () => {
    setOpenColor(value)
    picker.open()
  }

  const swatch = canvas ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={l`Opens the color picker`}
      onPress={onOpen}
      hitSlop={8}
      testID={testID ? `${testID}-swatch` : undefined}
      style={swatchStyle(value, t.atoms.border_contrast_low.borderColor)}
    />
  ) : (
    <BrowserColorInput
      label={label}
      value={value}
      onChange={onChange}
      testID={testID}
    />
  )

  return (
    <ColorFieldRow
      label={label}
      value={value}
      onChange={onChange}
      testID={testID}
      swatch={swatch}>
      {canvas && (
        <Dialog.Outer control={picker}>
          <Dialog.Close />
          <ColorPickerBody
            label={label}
            initialColor={normalizeHex(openColor) ?? FALLBACK_COLOR}
            onChange={onChange}
          />
        </Dialog.Outer>
      )}
    </ColorFieldRow>
  )
}

function ColorPickerBody({
  label,
  initialColor,
  onChange,
}: {
  label: string
  initialColor: string
  onChange: (hex: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  useTerrazzoTheme(t)

  // Opening in OKLCH keeps the sliders on L/C/H rather than r/g/b.
  const [color, setColor] = useColor(oklchCss(initialColor))
  const emitted = useRef(normalizeHex(initialColor))

  /*
   * The picker's code box forwards each keystroke as a color string. A partial
   * one ("#ff", "oklch(0.5") throws while parsing, which would unmount the
   * dialog mid-typing, so unparsable values are dropped and the box keeps its
   * own text.
   */
  const applyColor = (next: SetStateAction<ColorInput>) => {
    if (typeof next === 'string') {
      try {
        parse(next)
      } catch {
        return
      }
    }
    setColor(next)
  }

  useEffect(() => {
    const hex = pickerHex(color)
    if (hex === emitted.current) return
    emitted.current = hex
    onChange(hex)
  }, [color, onChange])

  return (
    <Dialog.ScrollableInner label={label}>
      <View style={[a.gap_lg, a.pb_sm]}>
        <Text style={[a.text_lg, a.font_semi_bold, t.atoms.text]}>{label}</Text>
        <ColorPicker
          color={color}
          setColor={applyColor}
          colorSpaces={['oklch', 'srgb']}
        />
        <Button
          label={l`Done`}
          color="primary"
          size="large"
          onPress={() => control.close()}>
          <ButtonText>
            <Trans>Done</Trans>
          </ButtonText>
        </Button>
      </View>
    </Dialog.ScrollableInner>
  )
}

/**
 * The stored color as an OKLCH CSS string, which is what makes the picker open
 * with L/C/H sliders.
 */
function oklchCss(hex: string) {
  const color = hexToOklch(hex) ?? {l: 0, c: 0, h: 0}
  return `oklch(${color.l} ${color.c} ${color.h})`
}

/** `#rrggbb` for the picker's color, gamut-mapped like the rest of the feature. */
function pickerHex(color: ColorOutput) {
  const [l, c, h] = color.oklch.coords
  return oklchToHex({l: l ?? 0, c: c ?? 0, h: h ?? 0})
}

/**
 * Browser picker for browsers without WebGL2. The DOM element is deliberate:
 * react-native-web's `createElement` filters props down to its own list and
 * would drop `value`/`onChange`.
 */
function BrowserColorInput({
  label,
  value,
  onChange,
  testID,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  testID?: string
}) {
  const t = useTheme()
  const [focused, setFocused] = useState(false)

  return (
    <View style={{width: SWATCH_SIZE, height: SWATCH_SIZE}}>
      <View
        aria-hidden
        style={swatchStyle(value, t.atoms.border_contrast_low.borderColor)}
      />
      <input
        type="color"
        value={normalizeHex(value) ?? '#000000'}
        aria-label={label}
        data-testid={testID ? `${testID}-swatch` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={event => {
          const hex = normalizeHex(event.currentTarget.value)
          if (hex) onChange(hex)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          border: 'none',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
      {focused && (
        <View
          aria-hidden
          pointerEvents="none"
          style={[
            a.rounded_full,
            {
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderWidth: 2,
              borderColor: t.palette.primary_500,
            },
          ]}
        />
      )}
    </View>
  )
}
