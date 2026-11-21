import {useState} from 'react'
import {View} from 'react-native'
import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Pressable} from '#/components/Pressable'
import {Text} from '#/components/Typography'
import {
  getGoogleFonts,
  GOOGLE_FONT_CATEGORIES,
  type GoogleFont,
  type GoogleFontCategory,
  useNameFontPreviewAlias,
} from '#/features/avatarDecorations'

const CATEGORY_LABELS: Record<GoogleFontCategory, MessageDescriptor> = {
  'Sans Serif': msg`Sans serif`,
  Display: msg`Display`,
  Serif: msg`Serif`,
  Handwriting: msg`Handwriting`,
  Monospace: msg`Monospace`,
}

type Filter = GoogleFontCategory | 'all'

/**
 * Picker for a custom display-name face. Rows render in their own face, which
 * the preview loader fetches as a subset of just the family's name, so opening
 * the picker costs a few kilobytes per visible row instead of a full font file
 * per row.
 */
export function DecorationFontPickerDialog({
  control,
  selected,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  selected?: string
  onSelect: (family: string) => void
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <Dialog.Handle />
      <Dialog.Close />
      <Body selected={selected} onSelect={onSelect} />
    </Dialog.Outer>
  )
}

function Body({
  selected,
  onSelect,
}: {
  selected?: string
  onSelect: (family: string) => void
}) {
  const control = Dialog.useDialogContext()
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const query = search.trim().toLowerCase()
  const fonts = getGoogleFonts().filter(
    font =>
      (filter === 'all' || font.category === filter) &&
      (!query || font.family.toLowerCase().includes(query)),
  )

  return (
    <Dialog.InnerFlatList
      data={fonts}
      keyExtractor={(font: GoogleFont) => font.family}
      initialNumToRender={12}
      windowSize={5}
      ListHeaderComponent={
        <View style={[a.gap_sm, a.pb_sm]}>
          <Text
            nativeID="dialog-title"
            style={[a.text_xl, a.font_semi_bold, t.atoms.text]}>
            <Trans>Display name font</Trans>
          </Text>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            label={l`Search fonts`}
            placeholder={l`Search fonts`}
            onClearText={() => setSearch('')}
          />
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            <FilterChip
              label={l`All`}
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {GOOGLE_FONT_CATEGORIES.map(category => (
              <FilterChip
                key={category}
                label={i18n._(CATEGORY_LABELS[category])}
                selected={filter === category}
                onPress={() => setFilter(category)}
              />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text
          style={[
            a.py_lg,
            a.text_md,
            a.text_center,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>No fonts match that search.</Trans>
        </Text>
      }
      renderItem={({item}: {item: GoogleFont}) => (
        <FontRow
          family={item.family}
          selected={selected === item.family}
          // Close first, then apply: the screen re-renders its preview and the
          // dialog is gone before that work starts.
          onPress={() => control.close(() => onSelect(item.family))}
        />
      )}
      style={[a.px_lg]}
    />
  )
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_full,
        a.px_md,
        a.py_2xs,
        selected ? t.atoms.bg_contrast_50 : t.atoms.bg_contrast_25,
      ]}>
      <Text
        style={[
          a.text_sm,
          a.font_semi_bold,
          selected ? t.atoms.text : t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
    </Pressable>
  )
}

function FontRow({
  family,
  selected,
  onPress,
}: {
  family: string
  selected: boolean
  onPress: () => void
}) {
  const t = useTheme()
  // Mounting the row starts the subset download. The alias stays undefined
  // until the face is usable, so a row never shows the app font as if it were
  // the preview.
  const preview = useNameFontPreviewAlias(family)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={family}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_md,
        t.atoms.border_contrast_low,
        {borderBottomWidth: 1},
      ]}>
      <Text
        numberOfLines={1}
        style={[
          a.flex_1,
          a.text_lg,
          t.atoms.text,
          preview ? {fontFamily: preview} : null,
        ]}>
        {family}
      </Text>
      {selected && <CheckIcon size="sm" style={t.atoms.text_contrast_medium} />}
    </Pressable>
  )
}
