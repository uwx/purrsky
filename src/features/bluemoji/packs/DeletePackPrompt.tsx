import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {useDeletePackMutation} from './mutations'
import {type BluemojiPack} from './util'

/**
 * Deleting a pack, with the choice of deleting its emoji as well.
 *
 * The emoji are collection items in their own right: removing the pack leaves
 * them alone, which is the safe default. Deleting them is a second decision,
 * confirmed on its own prompt because it destroys something the pack did not
 * own and cannot be undone.
 */
export function DeletePackPrompt({
  control,
  pack,
  emojiCount,
  onDeleted,
}: {
  control: Prompt.PromptControlProps
  pack?: BluemojiPack
  /** Memberships the pack has, when the caller already knows. */
  emojiCount?: number
  onDeleted?: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const confirmControl = Prompt.usePromptControl()
  const [deleteItems, setDeleteItems] = useState(false)
  const {mutate: deletePack, isPending} = useDeletePackMutation()

  const name = pack?.record.name ?? ''
  const hasEmoji = emojiCount === undefined || emojiCount > 0

  const remove = (alsoItems: boolean) => {
    if (!pack) return
    deletePack({pack, deleteItems: alsoItems}, {onSuccess: onDeleted})
  }

  return (
    <>
      <Prompt.Outer control={control} onClose={() => setDeleteItems(false)}>
        <Prompt.Content>
          <Prompt.TitleText>
            <Trans>Delete this pack?</Trans>
          </Prompt.TitleText>
          <Prompt.DescriptionText>
            {l`${name} stops existing. Its emoji stay in your collection.`}
          </Prompt.DescriptionText>
          {hasEmoji ? (
            <>
              <View style={[a.pb_sm]}>
                <Toggle.Item
                  name="delete_emoji"
                  label={l`Also delete the emoji in this pack`}
                  value={deleteItems}
                  onChange={setDeleteItems}>
                  <Toggle.LabelText>
                    <Trans>Also delete the emoji in this pack</Trans>
                  </Toggle.LabelText>
                  <Toggle.Platform />
                </Toggle.Item>
              </View>
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  a.pb_lg,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  Emoji that another pack also includes stay in your collection.
                </Trans>
              </Text>
            </>
          ) : null}
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta={l`Delete pack`}
            color="negative"
            disabled={!pack || isPending}
            onPress={() => {
              if (deleteItems) confirmControl.open()
              else remove(false)
            }}
          />
          <Prompt.Cancel />
        </Prompt.Actions>
      </Prompt.Outer>

      <Prompt.Basic
        control={confirmControl}
        title={l`Delete the emoji too?`}
        description={l`The emoji in ${name} are deleted from your collection, so posts and other places that use them lose the image. This cannot be undone.`}
        cancelButtonCta={l`Keep emoji`}
        confirmButtonCta={l`Delete emoji and pack`}
        confirmButtonColor="negative"
        onConfirm={() => remove(true)}
      />
    </>
  )
}
