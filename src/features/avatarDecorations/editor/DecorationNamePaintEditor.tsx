import {View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {
  type NameGradientPaint,
  useNameFontAlias,
} from '#/features/avatarDecorations'
import {DecorationColorField} from './DecorationColorField'

const DEFAULT_SOLID = '#7c3aed'
const DEFAULT_SECOND = '#28acdc'
const DEFAULT_THIRD = '#f2571f'

/**
 * Editor for an arbitrary display-name fill: one solid color, or a two- or
 * three-stop gradient with soft or hard edges.
 *
 * Exactly one slot is stored at a time. The record layer enforces that too, so
 * switching modes here only has to send the slot it wants and undefined for the
 * other one.
 */
export function DecorationNamePaintEditor({
  nameColor,
  nameGradient,
  onChange,
}: {
  nameColor?: string
  nameGradient?: NameGradientPaint
  onChange: (patch: {
    nameColor?: string
    nameGradient?: NameGradientPaint
  }) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const mode = nameGradient ? 'gradient' : 'solid'
  const colors = nameGradient?.colors ?? [nameColor ?? DEFAULT_SOLID]

  function setMode(next: string) {
    if (next === mode) return
    if (next === 'gradient') {
      const first = nameColor ?? DEFAULT_SOLID
      onChange({
        nameColor: undefined,
        nameGradient: {
          colors: [
            first,
            first === DEFAULT_SECOND ? DEFAULT_THIRD : DEFAULT_SECOND,
          ],
          hard: false,
        },
      })
    } else {
      onChange({nameColor: colors[0], nameGradient: undefined})
    }
  }

  function setColors(next: string[]) {
    onChange({nameGradient: {...nameGradient, colors: next}})
  }

  function setStop(index: number, color: string) {
    setColors(colors.map((stop, i) => (i === index ? color : stop)))
  }

  function setStopCount(next: string) {
    const count = Number(next)
    if (count === colors.length) return
    if (count === 3) {
      setColors([...colors, DEFAULT_THIRD])
    } else {
      setColors(colors.slice(0, 2))
    }
  }

  const strip = nameGradient
    ? nameGradient.hard
      ? {
          colors: colors.flatMap(color => [color, color]) as [
            string,
            string,
            ...string[],
          ],
          locations: colors.flatMap((_, index) => [
            index / colors.length,
            (index + 1) / colors.length,
          ]) as [number, number, ...number[]],
        }
      : {
          colors: colors as [string, string, ...string[]],
          locations: undefined,
        }
    : undefined

  return (
    <View style={[a.gap_sm]}>
      <SegmentedControl.Root
        label={l`Name fill`}
        type="radio"
        value={mode}
        onChange={setMode}
        size="small">
        <SegmentedControl.Item value="solid" label={l`Solid`}>
          <SegmentedControl.ItemText>
            <Trans>Solid</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="gradient" label={l`Gradient`}>
          <SegmentedControl.ItemText>
            <Trans>Gradient</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      {strip && (
        <LinearGradient
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          colors={strip.colors}
          locations={strip.locations}
          style={[a.rounded_sm, {height: 28}]}
        />
      )}

      {nameGradient ? (
        <>
          <View style={[a.flex_row, a.align_center, a.justify_between]}>
            <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text]}>
              <Trans>Colors</Trans>
            </Text>
            <View style={{width: 160}}>
              <SegmentedControl.Root
                label={l`Number of colors`}
                type="radio"
                value={String(colors.length)}
                onChange={setStopCount}
                size="small">
                <SegmentedControl.Item value="2" label={l`Two colors`}>
                  <SegmentedControl.ItemText>2</SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item value="3" label={l`Three colors`}>
                  <SegmentedControl.ItemText>3</SegmentedControl.ItemText>
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </View>
          </View>
          {colors.map((color, index) => (
            <DecorationColorField
              key={index}
              label={
                colors.length === 2
                  ? index === 0
                    ? l`Start color`
                    : l`End color`
                  : index === 0
                    ? l`Start color`
                    : index === 1
                      ? l`Middle color`
                      : l`End color`
              }
              value={color}
              onChange={next => setStop(index, next)}
              testID={`decoration-gradient-stop-${index}`}
            />
          ))}
          <Toggle.Item
            name="decoration_gradient_hard"
            label={l`Hard edges`}
            value={!!nameGradient.hard}
            onChange={hard => onChange({nameGradient: {...nameGradient, hard}})}
            style={[a.w_full]}>
            <Toggle.LabelText style={[a.flex_1]}>
              <Trans>Hard edges</Trans>
            </Toggle.LabelText>
            <Toggle.Platform />
          </Toggle.Item>
        </>
      ) : (
        <DecorationColorField
          label={l`Name color`}
          value={colors[0]}
          onChange={next => onChange({nameColor: next})}
          testID="decoration-name-color"
        />
      )}
    </View>
  )
}

/** Font name rendered in its own face once the whole face has loaded. */
export function DecorationFontPreview({
  family,
  fallback,
  style,
}: {
  family?: string
  fallback: string
  style?: React.ComponentProps<typeof Text>['style']
}) {
  const alias = useNameFontAlias(family)
  return (
    <Text numberOfLines={1} style={[style, alias ? {fontFamily: alias} : null]}>
      {family ?? fallback}
    </Text>
  )
}
