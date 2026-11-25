import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {openMultiplePicker, type RNImage} from '#/lib/media/picker'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {aliasFromFileName, aliasToRkey} from '#/features/bluemoji/alias'
import {type EmojiDraft} from '#/features/bluemoji/collection/mutations'
import {prepareEmojiImage} from '#/features/bluemoji/collection/prepare'
import {
  getPackDescriptionError,
  getPackNameError,
  PACK_DESCRIPTION_MAX_GRAPHEMES,
  PACK_NAME_MAX_BYTES,
} from '#/features/bluemoji/packs/util'
import {isCopyableLicense} from '#/features/bluemoji/provenance'

/** A picked file plus the alias it will be saved under. */
type Row = {image: RNImage & {fileName?: string}; alias: string}

/** The pack a bulk upload can create in the same pass, if the user opts in. */
export type BulkPackDraft = {name: string; description?: string}

/**
 * Add a whole folder of emoji in one go. Each alias defaults to the file name;
 * the field is here because a file name is rarely a good alias, and because it
 * is the only thing that can fail per item.
 */
export function BulkEmojiDialogForm({
  onSave,
  isPending,
}: {
  onSave: (
    drafts: EmojiDraft[],
    onProgress: (done: number) => void,
    pack?: BulkPackDraft,
  ) => void
  isPending: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [rows, setRows] = useState<Row[]>([])
  const [done, setDone] = useState(0)
  const [license, setLicense] = useState('')
  const [asPack, setAsPack] = useState(false)
  const [packName, setPackName] = useState('')
  const [packDescription, setPackDescription] = useState('')
  const packNameError = asPack ? getPackNameError(packName) : undefined
  const packDescriptionError = asPack
    ? getPackDescriptionError(packDescription)
    : undefined

  const pick = async () => {
    const images = await openMultiplePicker()
    if (!images.length) return
    setRows(
      images.map((image, index) => ({
        image,
        // Two files with the same alias would write the same record, so the
        // fallback is indexed rather than derived from a clock.
        alias: image.fileName
          ? aliasFromFileName(image.fileName)
          : `emoji_${index + 1}`,
      })),
    )
  }

  // Later duplicates would overwrite earlier ones on write, since the alias is
  // the record key.
  const duplicates = rows
    .map(row => row.alias.trim().toLowerCase())
    .filter((alias, index, all) => alias && all.indexOf(alias) !== index)
  const invalid = rows.filter(row => !isValidAlias(row.alias))
  const canSubmit =
    rows.length > 0 &&
    !invalid.length &&
    !duplicates.length &&
    !packNameError &&
    !packDescriptionError &&
    !isPending

  const save = async () => {
    // Prepare up front, sequentially, so a huge folder does not spike memory.
    const drafts: EmojiDraft[] = []
    let flattened = 0
    for (const row of rows) {
      const image = await prepareEmojiImage(row.image)
      if (image.flattened) flattened++
      drafts.push({alias: row.alias, license, image})
    }
    if (flattened) {
      Toast.show(
        plural(flattened, {
          one: '# animation is over the 128 KB emoji limit, so it is saved as a still image.',
          other:
            '# animations are over the 128 KB emoji limit, so they are saved as still images.',
        }),
        {type: 'warning'},
      )
    }
    setDone(0)
    onSave(
      drafts,
      setDone,
      asPack
        ? {
            name: packName.trim(),
            description: packDescription.trim() || undefined,
          }
        : undefined,
    )
  }

  return (
    <Dialog.ScrollableInner label={l`Bulk upload`}>
      <View style={[a.gap_md, a.pb_lg]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Pick several images at once and save them as emoji. Each alias
            starts as the file name; rename any that you want to be easier to
            type.
          </Trans>
        </Text>

        <View style={[a.w_full, a.align_start]}>
          <Button
            color="secondary"
            size="small"
            label={l`Choose images`}
            onPress={() => void pick()}>
            <ButtonText>
              <Trans>Choose images</Trans>
            </ButtonText>
          </Button>
        </View>

        <TextField.Root>
          <TextField.LabelText>
            <Trans>License</Trans>
          </TextField.LabelText>
          <TextField.Input
            label={l`License`}
            placeholder="CC-BY-4.0"
            value={license}
            onChangeText={setLicense}
            maxLength={128}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </TextField.Root>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {license.trim() && !isCopyableLicense(license) ? (
            <Trans>
              This licence does not let others add these emoji to their
              collection. Use an SPDX identifier such as CC-BY-4.0 or CC0-1.0.
            </Trans>
          ) : (
            <Trans>
              Applies to every emoji in this batch. Without a licence, others
              cannot add them to their collection.
            </Trans>
          )}
        </Text>

        <Toggle.Item
          name="as_pack"
          label={l`Also save as a pack`}
          value={asPack}
          onChange={setAsPack}>
          <Toggle.LabelText>
            <Trans>Also save as a pack</Trans>
          </Toggle.LabelText>
          <Toggle.Platform />
        </Toggle.Item>
        {asPack ? (
          <>
            <TextField.Root isInvalid={!!packNameError}>
              <TextField.LabelText>
                <Trans>Name</Trans>
              </TextField.LabelText>
              <TextField.Input
                label={l`Pack name`}
                placeholder={l`cute cats`}
                value={packName}
                onChangeText={setPackName}
                maxLength={PACK_NAME_MAX_BYTES}
              />
            </TextField.Root>
            {packNameError === 'empty' ? (
              <AliasProblemText>
                <Trans>Give the pack a name.</Trans>
              </AliasProblemText>
            ) : packNameError ? (
              <AliasProblemText>
                <Trans>Pack names are limited to 64 bytes.</Trans>
              </AliasProblemText>
            ) : null}
            <TextField.Root isInvalid={!!packDescriptionError}>
              <TextField.LabelText>
                <Trans>Description</Trans>
              </TextField.LabelText>
              <TextField.Input
                label={l`Pack description`}
                placeholder={l`What is in this pack?`}
                value={packDescription}
                onChangeText={setPackDescription}
                multiline
                numberOfLines={3}
              />
            </TextField.Root>
            {packDescriptionError ? (
              <AliasProblemText>
                <Trans>
                  Descriptions are limited to {PACK_DESCRIPTION_MAX_GRAPHEMES}
                  characters.
                </Trans>
              </AliasProblemText>
            ) : null}
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                The first emoji becomes the pack icon. Only the emoji that saved
                successfully are added to the pack.
              </Trans>
            </Text>
          </>
        ) : null}

        {rows.map((row, index) => (
          <View key={`${row.image.path}-${index}`} style={[a.gap_2xs]}>
            <TextField.Root isInvalid={!isValidAlias(row.alias)}>
              <TextField.LabelText>
                {row.image.fileName ?? l`Image`}
              </TextField.LabelText>
              <TextField.Input
                label={l`Alias`}
                value={row.alias}
                onChangeText={alias =>
                  setRows(previous =>
                    previous.map((current, i) =>
                      i === index ? {...current, alias} : current,
                    ),
                  )
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
            {!isValidAlias(row.alias) ? (
              <AliasProblemText>
                <Trans>Use letters, numbers, and . _ - with no spaces.</Trans>
              </AliasProblemText>
            ) : duplicates.includes(row.alias.trim().toLowerCase()) ? (
              <AliasProblemText>
                <Trans>Another image already uses this alias.</Trans>
              </AliasProblemText>
            ) : null}
          </View>
        ))}

        {(invalid.length || duplicates.length) && rows.length ? (
          <Admonition type="warning">
            <Trans>Some aliases need changing before you can save.</Trans>
          </Admonition>
        ) : null}

        {isPending ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {asPack && done >= rows.length ? (
              <Trans>Creating the pack…</Trans>
            ) : (
              <Trans>
                Adding {done} of {rows.length}…
              </Trans>
            )}
          </Text>
        ) : null}

        <Button
          color="primary"
          size="large"
          disabled={!canSubmit}
          label={l`Add emoji`}
          onPress={() => void save()}>
          <ButtonText>
            {isPending ? (
              <Trans>Adding…</Trans>
            ) : (
              <Trans>Add {rows.length || ''} emoji</Trans>
            )}
          </ButtonText>
        </Button>
      </View>
      {IS_WEB ? <Dialog.Close /> : null}
    </Dialog.ScrollableInner>
  )
}

function AliasProblemText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text style={[a.text_xs, {color: t.palette.negative_500}]}>{children}</Text>
  )
}

/** True when the alias survives the same validation the record write applies. */
function isValidAlias(alias: string) {
  try {
    aliasToRkey(alias)
    return true
  } catch {
    return false
  }
}
