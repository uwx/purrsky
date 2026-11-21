import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import ColorPicker, {HueSlider, Panel1} from 'reanimated-color-picker'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Pressable} from '#/components/Pressable'
import {Text} from '#/components/Typography'
import {normalizeHex} from '#/features/avatarDecorations/oklch'
import {ColorFieldRow, FALLBACK_COLOR, swatchStyle} from './shared'

/**
 * Solid color editor: a swatch that opens the color picker plus a hex box for
 * exact values. The record stores `#rrggbb`, so whatever the eye picks in HSV
 * lands in the same slot other clients read.
 *
 * Native only. The picker is gesture-driven, and the web bundle rejects
 * react-native-gesture-handler, so web gets the browser's own picker instead:
 * see index.web.tsx.
 */
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

  /*
   * The picker opens at a frozen color. `value` changes on every gesture frame
   * and feeding it back would reset the thumb mid-drag; a reopen still starts
   * from what is stored because this is refreshed on each open.
   */
  const [openColor, setOpenColor] = useState(value)
  const onOpen = () => {
    setOpenColor(value)
    picker.open()
  }

  return (
    <ColorFieldRow
      label={label}
      value={value}
      onChange={onChange}
      testID={testID}
      swatch={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={l`Opens the color picker`}
          onPress={onOpen}
          hitSlop={8}
          testID={testID ? `${testID}-swatch` : undefined}
          style={swatchStyle(value, t.atoms.border_contrast_low.borderColor)}
        />
      }>
      <Dialog.Outer control={picker}>
        <Dialog.Handle />
        <Dialog.Close />
        <ColorPickerBody
          label={label}
          initialColor={normalizeHex(openColor) ?? FALLBACK_COLOR}
          onChange={onChange}
        />
      </Dialog.Outer>
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

  return (
    <Dialog.ScrollableInner label={label}>
      <View style={[a.gap_lg, a.pb_sm]}>
        <Text style={[a.text_lg, a.font_semi_bold, t.atoms.text]}>{label}</Text>
        <ColorPicker
          value={initialColor}
          style={[a.gap_md]}
          sliderThickness={20}
          thumbSize={26}
          thumbShape="ring"
          boundedThumb
          onChangeJS={({hex}) => {
            const next = normalizeHex(hex)
            if (next) onChange(next)
          }}>
          <Panel1 style={[a.rounded_sm, {height: 180}]} />
          <HueSlider style={[a.rounded_sm]} />
        </ColorPicker>
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
