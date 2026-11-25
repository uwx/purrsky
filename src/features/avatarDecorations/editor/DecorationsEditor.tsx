import {useCallback, useState} from 'react'
import {View} from 'react-native'
import {UIImagePickerPreferredAssetRepresentationMode} from 'expo-image-picker'
import {LinearGradient} from 'expo-linear-gradient'
import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePhotoLibraryPermission} from '#/lib/hooks/usePermissions'
import {openPicker} from '#/lib/media/picker'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useA11y} from '#/state/a11y'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Pressable} from '#/components/Pressable'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
/*
 * Sibling modules, not the feature barrel: the barrel exports this component,
 * so importing it back would close a cycle.
 */
import {type AnimatedAvatarPick, checkAnimatedAvatar} from '../animatedAvatar'
import {AVATAR_SHAPES, type AvatarShape} from '../avatarShapes'
import {DECORATION_FRAMES, getFrame, resolveFrame} from '../catalog'
import {type DecorationDraft, resolveDraft} from '../draft'
import {useNameFontAlias} from '../nameFonts'
import {NAME_GRADIENTS, type NameGradient} from '../nameGradients'
import {nameGradientTextStyle} from '../nameGradientStyle'
import {resolveNamePaint} from '../namePaint'
import {type DecorationSettings, type NameGradientPaint} from '../records'
import {
  type AnimatedAvatarSource,
  useAnimatedAvatarBlob,
} from '../useDecorations'
import {DecorationColorField} from './DecorationColorField'
import {DecorationFontPickerDialog} from './DecorationFontPicker'
import {
  DecorationFontPreview,
  DecorationNamePaintEditor,
} from './DecorationNamePaintEditor'

/**
 * The whole profile decorations form. It owns no record state: the screen and
 * the edit-profile dialog each keep a draft and hand it down, so a draft can be
 * saved with whatever else the host is saving.
 */
export function DecorationsEditor({
  saved,
  draft,
  onEdit,
  did,
  avatar,
  displayName,
  handle,
  disabled = false,
}: {
  saved: DecorationSettings
  draft: DecorationDraft
  onEdit: (patch: Partial<Omit<DecorationDraft, 'touched'>>) => void
  /** Owner of the record, so the preview can play a stored animation. */
  did?: string
  /** Current profile picture, previewed underneath the decorations. */
  avatar?: string | null
  displayName?: string
  handle?: string
  disabled?: boolean
}) {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const reduceMotion = useA11y().reduceMotionEnabled
  const [pickingAnimation, setPickingAnimation] = useState(false)
  const {requestPhotoAccessIfNeeded} = usePhotoLibraryPermission()
  const fontPicker = Dialog.useDialogControl()

  const selected = resolveDraft(draft, saved)
  // The saved settings and the draft share a shape for every name slot, so the
  // preview resolves through the same function the feeds use.
  const paint = resolveNamePaint({
    name: selected.name,
    nameColor: selected.nameColor,
    nameGradient: selected.nameGradient,
    nameOutline: selected.nameOutline,
    nameFont: selected.nameFont,
  })
  const previewFrame = resolveFrame(selected.avatar, selected.avatarColor)
  const previewFont = useNameFontAlias(paint?.font)
  const savedAnimation = useAnimatedAvatarBlob(
    did,
    selected.animatedPick ? undefined : selected.avatarAnimated,
  )
  /*
   * A picked file previews in place of the stored animation. Reduced motion
   * shows the current profile picture rather than animating a file that has no
   * still rendition yet.
   */
  const previewAnimation: AnimatedAvatarSource | undefined = selected.animatedPick
    ? reduceMotion
      ? undefined
      : {
          playUri: selected.animatedPick.path,
          stillUri: selected.animatedPick.path,
          cid: selected.animatedPick.path,
        }
    : savedAnimation

  const customNameSelected = !!selected.nameColor || !!selected.nameGradient
  const hasNamePaint = !!(paint?.gradient || paint?.color)
  const outlineStyle = paint
    ? paint.gradient
      ? nameGradientTextStyle(paint.gradient, {outline: paint.outline})
      : paint.color
        ? nameGradientTextStyle(
            {colors: [paint.color], solid: paint.color},
            {outline: paint.outline},
          )
        : undefined
    : undefined

  const previewName = sanitizeDisplayName(
    displayName || sanitizeHandle(handle || ''),
  )

  function edit(patch: Partial<Omit<DecorationDraft, 'touched'>>) {
    onEdit(patch)
  }

  const onPickAnimation = useCallback(async () => {
    if (!(await requestPhotoAccessIfNeeded())) return
    setPickingAnimation(true)
    try {
      const [asset] = await openPicker({
        allowsEditing: false,
        selectionLimit: 1,
        // Transcoding is what turns an animated GIF into a still on iOS.
        preferredAssetRepresentationMode:
          UIImagePickerPreferredAssetRepresentationMode.Current,
      })
      if (!asset) return
      const check = checkAnimatedAvatar(asset)
      if (!check.ok) {
        Toast.show(
          check.reason === 'size'
            ? l`That animation is larger than 4 MB.`
            : l`Choose a GIF, WebP, APNG, or AVIF file.`,
        )
        return
      }
      const pick: AnimatedAvatarPick = {
        mime: asset.mime,
        path: asset.path,
        size: asset.size,
        fileName: asset.fileName,
      }
      // The previous blob is replaced on save, so drop it now: a failed upload
      // must not leave the old animation looking selected.
      edit({animatedPick: pick, avatarAnimated: undefined})
    } catch (error) {
      logger.error('Failed to pick an animated avatar', {safeMessage: error})
    } finally {
      setPickingAnimation(false)
    }
  }, [requestPhotoAccessIfNeeded, l])

  const animationMime = selected.animatedPick?.mime
    ? selected.animatedPick.mime
    : selected.avatarAnimated?.mimeType

  return (
    <View style={[a.gap_2xl]}>
      <View
        style={[
          a.p_xl,
          a.rounded_md,
          a.align_center,
          a.justify_center,
          a.gap_md,
          t.atoms.bg_contrast_25,
        ]}>
        <UserAvatar
          type="user"
          size={80}
          avatar={avatar}
          animatedAvatar={previewAnimation}
          decoration={previewFrame}
          profileShape={selected.avatarShape}
        />
        <Text
          gradient={paint?.gradient}
          style={[
            a.text_2xl,
            a.font_bold,
            t.atoms.text,
            previewFont ? {fontFamily: previewFont} : null,
            outlineStyle,
          ]}
          numberOfLines={1}>
          {previewName}
        </Text>
      </View>

      <Section titleText={<Trans>Animated picture</Trans>}>
        <Text
          style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Plays instead of your profile picture, in apps that support it.
            Everyone else, including people who reduce motion, sees the first
            frame.
          </Trans>
        </Text>
        {animationMime ? (
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <View style={[a.flex_1, {minWidth: 0}]}>
              <Text numberOfLines={1} style={[a.text_sm, a.font_semi_bold]}>
                {selected.animatedPick?.fileName ?? animationMime.toUpperCase()}
              </Text>
              <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {selected.animatedPick
                  ? formatBytes(selected.animatedPick.size)
                  : selected.avatarAnimated &&
                      'size' in selected.avatarAnimated
                    ? formatBytes(selected.avatarAnimated.size)
                    : ''}
              </Text>
            </View>
            <Button
              testID="decoration-animation-pick"
              label={l`Replace animation`}
              size="small"
              color="secondary"
              disabled={disabled || pickingAnimation}
              onPress={() => void onPickAnimation()}>
              <ButtonText>
                <Trans>Replace</Trans>
              </ButtonText>
            </Button>
            <Button
              testID="decoration-animation-remove"
              label={l`Remove animation`}
              size="small"
              color="secondary"
              disabled={disabled}
              onPress={() =>
                edit({animatedPick: undefined, avatarAnimated: undefined})
              }>
              <ButtonText>
                <Trans>Remove</Trans>
              </ButtonText>
            </Button>
          </View>
        ) : (
          <View style={[a.flex_row]}>
            <Button
              testID="decoration-animation-pick"
              label={l`Choose an animation`}
              size="small"
              color="secondary"
              disabled={disabled || pickingAnimation}
              onPress={() => void onPickAnimation()}>
              <ButtonText>
                <Trans>Choose file</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
      </Section>

      <Section titleText={<Trans>Profile frame</Trans>}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          <ChoiceButton
            testID="decoration-frame-none"
            label={l`None`}
            selected={!selected.avatar && !selected.avatarColor}
            onPress={() => edit({avatar: undefined, avatarColor: undefined})}
          />
          {DECORATION_FRAMES.map(item => (
            <ChoiceButton
              key={item.id}
              testID={`decoration-frame-${item.id}`}
              label={i18n._(item.name)}
              selected={selected.avatar === item.id && !selected.avatarColor}
              onPress={() => edit({avatar: item.id, avatarColor: undefined})}
            />
          ))}
          <ChoiceButton
            testID="decoration-frame-custom"
            label={l`Custom`}
            selected={!!selected.avatarColor}
            onPress={() =>
              edit({
                avatarColor:
                  selected.avatarColor ??
                  getFrame(selected.avatar)?.color ??
                  DEFAULT_FRAME_COLOR,
              })
            }
          />
        </View>
        {selected.avatarColor && (
          <DecorationColorField
            label={l`Frame color`}
            value={selected.avatarColor}
            onChange={color => edit({avatarColor: color})}
            testID="decoration-frame-color"
          />
        )}
      </Section>

      <Section titleText={<Trans>Avatar shape</Trans>}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          <ChoiceButton
            testID="avatar-shape-default"
            label={l`Default`}
            selected={!selected.avatarShape}
            onPress={() => edit({avatarShape: undefined})}
          />
          {AVATAR_SHAPES.map(item => (
            <ChoiceButton
              key={item}
              testID={`avatar-shape-${item}`}
              label={i18n._(SHAPE_LABELS[item])}
              selected={selected.avatarShape === item}
              onPress={() => edit({avatarShape: item})}
            />
          ))}
        </View>
      </Section>

      <Section titleText={<Trans>Display name</Trans>}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          <NoneSwatch
            testID="decoration-gradient-none"
            selected={!selected.name && !customNameSelected}
            onPress={() =>
              edit({
                name: undefined,
                nameColor: undefined,
                nameGradient: undefined,
              })
            }
          />
          <CustomNameSwatch
            selected={customNameSelected}
            nameColor={selected.nameColor}
            nameGradient={selected.nameGradient}
            onPress={() => {
              if (!customNameSelected) {
                edit({name: undefined, nameColor: DEFAULT_NAME_COLOR})
              }
            }}
          />
          {NAME_GRADIENTS.map(gradient => (
            <GradientSwatch
              key={gradient.id}
              gradient={gradient}
              selected={!customNameSelected && selected.name === gradient.id}
              onPress={() =>
                edit({
                  name: gradient.id,
                  nameColor: undefined,
                  nameGradient: undefined,
                })
              }
            />
          ))}
        </View>

        {customNameSelected && (
          <DecorationNamePaintEditor
            nameColor={selected.nameColor}
            nameGradient={selected.nameGradient}
            onChange={patch => edit({name: undefined, ...patch})}
          />
        )}
      </Section>

      <Section titleText={<Trans>Outline</Trans>}>
        <Toggle.Item
          name="decoration_name_outline"
          label={l`Outline`}
          value={selected.nameOutline}
          disabled={disabled || !hasNamePaint}
          onChange={value => edit({nameOutline: value})}
          style={[a.w_full]}>
          <Toggle.LabelText style={[a.flex_1]}>
            <Trans>Outline</Trans>
          </Toggle.LabelText>
          <Toggle.Platform />
        </Toggle.Item>
        <Text
          style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Adds a dark edge so the name stays readable on any background. It
            turns white when the name itself is dark.
          </Trans>
        </Text>
      </Section>

      <Section titleText={<Trans>Name font</Trans>}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <View style={[a.flex_1, {minWidth: 0}]}>
            <DecorationFontPreview
              family={selected.nameFont}
              fallback={l`Default font`}
              style={[
                a.text_lg,
                selected.nameFont ? t.atoms.text : t.atoms.text_contrast_medium,
              ]}
            />
          </View>
          <Button
            testID="decoration-font-pick"
            label={l`Choose font`}
            size="small"
            color="secondary"
            disabled={disabled}
            onPress={fontPicker.open}>
            <ButtonText>
              <Trans>Choose</Trans>
            </ButtonText>
          </Button>
          {selected.nameFont && (
            <Button
              testID="decoration-font-default"
              label={l`Default font`}
              size="small"
              color="secondary"
              disabled={disabled}
              onPress={() => edit({nameFont: undefined})}>
              <ButtonText>
                <Trans>Default</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
        <Text
          style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Fonts load from Google Fonts when someone first sees the name. Emoji
            keep their own font.
          </Trans>
        </Text>
      </Section>

      <DecorationFontPickerDialog
        control={fontPicker}
        selected={selected.nameFont}
        onSelect={family => edit({nameFont: family})}
      />
    </View>
  )
}

function Section({
  titleText,
  children,
}: {
  titleText: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_sm]}>
      <Text style={[a.text_md, a.font_semi_bold, t.atoms.text]}>{titleText}</Text>
      {children}
    </View>
  )
}

const SHAPE_LABELS: Record<AvatarShape, MessageDescriptor> = {
  circle: msg`Circle`,
  square: msg`Square`,
  squircle: msg`Squircle`,
  hexagon: msg`Hexagon`,
  triangle: msg`Triangle`,
}

const SWATCH_HEIGHT = 52

/** Ring color a custom frame starts at when no frame is selected yet. */
const DEFAULT_FRAME_COLOR = '#c084fc'

/** Fill a custom name starts at when the user switches away from a preset. */
const DEFAULT_NAME_COLOR = '#7c3aed'

function formatBytes(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} kB`
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`
}

/** Swatch that opens the custom paint editor. */
function CustomNameSwatch({
  selected,
  nameColor,
  nameGradient,
  onPress,
}: {
  selected: boolean
  nameColor?: string
  nameGradient?: NameGradientPaint
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const colors = nameGradient?.hard
    ? nameGradient.colors.flatMap(color => [color, color])
    : (nameGradient?.colors ?? [nameColor ?? DEFAULT_NAME_COLOR])
  const locations = nameGradient?.hard
    ? (nameGradient.colors.flatMap((_, index) => [
        index / nameGradient.colors.length,
        (index + 1) / nameGradient.colors.length,
      ]) as [number, number, ...number[]])
    : undefined

  return (
    <Pressable
      testID="decoration-gradient-custom"
      accessibilityRole="button"
      accessibilityLabel={l`Custom`}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_md,
        a.overflow_hidden,
        {height: SWATCH_HEIGHT, flexBasis: '31%', flexGrow: 1},
        selected
          ? {borderWidth: 2, borderColor: t.atoms.text.color}
          : {
              borderWidth: 1,
              borderColor: t.atoms.border_contrast_low.borderColor,
            },
      ]}>
      {/*
       * A solid name paint has one stop. Android's LinearGradient rejects
       * fewer than two colors, so paint it flat instead.
       */}
      {colors.length < 2 ? (
        <View
          testID="decoration-gradient-custom-fill"
          style={[a.absolute, a.inset_0, {backgroundColor: colors[0]}]}
        />
      ) : (
        <LinearGradient
          colors={colors as [string, string, ...string[]]}
          locations={locations}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[a.absolute, a.inset_0]}
        />
      )}
      <View style={[a.flex_1, a.align_center, a.justify_center, a.px_sm]}>
        <View
          style={[
            a.rounded_full,
            a.px_xs,
            {maxWidth: '100%', backgroundColor: 'rgba(0, 0, 0, 0.75)'},
          ]}>
          <Text
            numberOfLines={1}
            style={[a.text_sm, a.font_bold, {color: '#FFFFFF'}]}>
            <Trans>Custom</Trans>
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

function ChoiceButton({
  testID,
  label,
  selected,
  onPress,
}: {
  testID: string
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Button
      testID={testID}
      label={label}
      accessibilityState={{selected}}
      color={selected ? 'primary' : 'secondary'}
      size="small"
      onPress={onPress}>
      <ButtonText>{label}</ButtonText>
    </Button>
  )
}

function GradientSwatch({
  gradient,
  selected,
  onPress,
}: {
  gradient: NameGradient
  selected: boolean
  onPress: () => void
}) {
  const {i18n} = useLingui()
  const t = useTheme()
  // Hard-stop bands need doubled stops to render as flat color blocks.
  const colors = gradient.segmented
    ? gradient.colors.flatMap(color => [color, color])
    : gradient.colors
  const locations = gradient.segmented
    ? gradient.colors.flatMap((_, index) => [
        index / gradient.colors.length,
        (index + 1) / gradient.colors.length,
      ])
    : undefined
  return (
    <Pressable
      testID={`decoration-gradient-${gradient.id}`}
      accessibilityRole="button"
      accessibilityLabel={i18n._(gradient.name)}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_md,
        a.overflow_hidden,
        {height: SWATCH_HEIGHT, flexBasis: '31%', flexGrow: 1},
        selected && {borderWidth: 2, borderColor: t.atoms.text.color},
      ]}>
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        locations={locations as [number, number, ...number[]] | undefined}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[a.absolute, a.inset_0]}
      />
      <View style={[a.flex_1, a.align_center, a.justify_center, a.px_sm]}>
        <View
          style={[
            a.rounded_full,
            a.px_xs,
            {maxWidth: '100%', backgroundColor: 'rgba(0, 0, 0, 0.75)'},
          ]}>
          <Text
            numberOfLines={1}
            style={[a.text_sm, a.font_bold, {color: '#FFFFFF'}]}>
            {i18n._(gradient.name)}
          </Text>
        </View>
        {selected && (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                top: 4,
                right: 4,
                width: 18,
                height: 18,
                backgroundColor: 'rgba(0,0,0,0.35)',
              },
            ]}>
            <CheckIcon size="xs" fill="#FFFFFF" />
          </View>
        )}
      </View>
    </Pressable>
  )
}

function NoneSwatch({
  testID,
  selected,
  onPress,
}: {
  testID: string
  selected: boolean
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={l`None`}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_md,
        a.align_center,
        a.justify_center,
        t.atoms.bg_contrast_25,
        {height: SWATCH_HEIGHT, flexBasis: '31%', flexGrow: 1},
        selected
          ? {borderWidth: 2, borderColor: t.atoms.text.color}
          : {
              borderWidth: 1,
              borderColor: t.atoms.border_contrast_low.borderColor,
            },
      ]}>
      <Text style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
        <Trans>None</Trans>
      </Text>
    </Pressable>
  )
}
