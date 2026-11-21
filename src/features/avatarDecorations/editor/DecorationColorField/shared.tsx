import {useState} from 'react'
import {View} from 'react-native'

import {atoms as a} from '#/alf'
import * as TextField from '#/components/forms/TextField'
import {normalizeHex} from '#/features/avatarDecorations/oklch'

/** Diameter of the chip that fronts the hex box. */
export const SWATCH_SIZE = 32

/** Color the pickers open at when the stored value cannot be parsed. */
export const FALLBACK_COLOR = '#7c3aed'

/**
 * The visible chip. Platforms differ only in what a press does, so the chip
 * itself is shared to keep the field looking the same on both.
 */
export function swatchStyle(color: string, borderColor?: string) {
  return [
    a.rounded_full,
    {
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      backgroundColor: color,
      borderWidth: 1,
      borderColor,
    },
  ]
}

/**
 * Hex box plus a platform-supplied picker trigger.
 *
 * The box keeps its own text so half-typed values ("#ff") do not snap back to
 * the last valid color. An outside change (a picker move) is adopted only when
 * the text does not already mean that color: "#123" emits "#112233", and
 * rewriting the box mid-typing would fight the user.
 */
export function ColorFieldRow({
  label,
  value,
  onChange,
  testID,
  swatch,
  children,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  testID?: string
  /** Picker trigger, sized with `swatchStyle`. */
  swatch: React.ReactNode
  /** Kept inside the row so the picker surface has a stable parent. */
  children?: React.ReactNode
}) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (normalizeHex(text) !== value) setText(value)
  }

  return (
    <View style={[a.gap_sm]} testID={testID}>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        {swatch}
        <TextField.Root style={[a.flex_1]}>
          <TextField.Input
            label={label}
            value={text}
            onChangeText={next => {
              setText(next)
              const hex = normalizeHex(next)
              if (hex) onChange(hex)
            }}
            placeholder={null}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            testID={testID ? `${testID}-hex` : undefined}
          />
        </TextField.Root>
      </View>
      {children}
    </View>
  )
}
