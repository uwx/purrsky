import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {compressIfNeeded} from '#/lib/media/manip'
import {openPicker, type RNImage} from '#/lib/media/picker'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {type PackDraft, useSavePackMutation} from './mutations'
import {
  type BluemojiPack,
  getPackDescriptionError,
  getPackIconUrl,
  getPackNameError,
  PACK_DESCRIPTION_MAX_GRAPHEMES,
  PACK_NAME_MAX_BYTES,
} from './util'

/**
 * Create and edit in one form. An edit keeps its icon unless the viewer picks a
 * new one, and keeps fields this form does not own (facets, labels).
 */
export function PackFormDialog({
  editing,
  onDone,
}: {
  editing?: BluemojiPack
  onDone: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {mutate: save, isPending} = useSavePackMutation()
  const [file, setFile] = useState<RNImage | null>(null)
  const [name, setName] = useState(editing?.record.name ?? '')
  const [description, setDescription] = useState(
    editing?.record.description ?? '',
  )
  const [source, setSource] = useState(editing?.record.source ?? '')
  const [license, setLicense] = useState(editing?.record.license ?? '')
  const [adultOnly, setAdultOnly] = useState(editing?.record.adultOnly ?? false)

  const pick = async () => {
    const [asset] = await openPicker()
    if (!asset) return
    setFile(
      await compressIfNeeded(asset, {
        maxDimension: 512,
        maxSize: 1_000_000,
      }),
    )
  }

  const nameError = getPackNameError(name)
  const descriptionError = getPackDescriptionError(description)
  const canSubmit = !nameError && !descriptionError && !isPending

  return (
    <Dialog.ScrollableInner label={editing ? l`Edit pack` : l`New pack`}>
      <View style={[a.gap_md, a.pb_lg]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            A pack groups emoji you made or collected so others can add the
            whole set at once. Pack links render as a card in Witchsky and a
            plain link everywhere else.
          </Trans>
        </Text>

        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <View
            style={[
              a.rounded_md,
              a.overflow_hidden,
              a.align_center,
              a.justify_center,
              {width: 64, height: 64},
              t.atoms.bg_contrast_25,
            ]}>
            {file ? (
              <Image
                source={{uri: file.path}}
                contentFit="cover"
                style={{width: 64, height: 64}}
                accessibilityLabel={l`Pack icon preview`}
                accessibilityHint={undefined}
              />
            ) : editing && getPackIconUrl(editing) ? (
              <Image
                source={{uri: getPackIconUrl(editing)}}
                contentFit="cover"
                style={{width: 64, height: 64}}
                accessibilityLabel={l`Pack icon`}
                accessibilityHint={undefined}
              />
            ) : null}
          </View>
          <Button
            color="secondary"
            size="small"
            label={l`Choose an icon`}
            onPress={() => void pick()}>
            <ButtonText>
              <Trans>Choose an icon</Trans>
            </ButtonText>
          </Button>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`Pack name`}
              placeholder={l`cute cats`}
              value={name}
              onChangeText={setName}
              maxLength={PACK_NAME_MAX_BYTES}
            />
          </TextField.Root>
        </View>
        {nameError === 'too_long' ? (
          <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
            <Trans>Pack names are limited to 64 bytes.</Trans>
          </Text>
        ) : null}

        <View>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`Pack description`}
              placeholder={l`What is in this pack?`}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </TextField.Root>
        </View>
        {descriptionError ? (
          <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
            <Trans>
              Descriptions are limited to {PACK_DESCRIPTION_MAX_GRAPHEMES}
              characters.
            </Trans>
          </Text>
        ) : null}

        <View>
          <TextField.LabelText>
            <Trans>Source</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`Source URL`}
              placeholder="https://"
              value={source}
              onChangeText={setSource}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </TextField.Root>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>License</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`License`}
              placeholder="CC-BY-4.0"
              value={license}
              onChangeText={setLicense}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </TextField.Root>
        </View>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            This describes the pack. Whether someone else may add an emoji to
            their own collection is decided by that emoji's licence, set on the
            emoji itself.
          </Trans>
        </Text>

        <Toggle.Item
          name="adult_only"
          label={l`Adult content`}
          value={adultOnly}
          onChange={setAdultOnly}>
          <Toggle.LabelText>
            <Trans>Adult content</Trans>
          </Toggle.LabelText>
          <Toggle.Platform />
        </Toggle.Item>

        <Button
          color="primary"
          size="large"
          disabled={!canSubmit}
          label={editing ? l`Save pack` : l`Create pack`}
          onPress={() => {
            const draft: PackDraft = {
              name,
              description,
              adultOnly,
              source,
              license,
              icon: file ?? undefined,
            }
            save({draft, editing}, {onSuccess: onDone})
          }}>
          <ButtonText>
            {isPending ? (
              <Trans>Saving…</Trans>
            ) : editing ? (
              <Trans>Save pack</Trans>
            ) : (
              <Trans>Create pack</Trans>
            )}
          </ButtonText>
        </Button>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
