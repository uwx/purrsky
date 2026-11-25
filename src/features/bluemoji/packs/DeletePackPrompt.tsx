import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
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
 *
 * The delete itself can take a while, so it runs behind a dialog the user
 * cannot dismiss: the prompts close on press, and without this the work would
 * continue invisibly and the user could leave the screen mid-delete.
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
  const progressControl = Dialog.useDialogControl()
  const [deleteItems, setDeleteItems] = useState(false)
  const [progress, setProgress] = useState<{done: number; total: number}>()
  const {mutate: deletePack, isPending} = useDeletePackMutation()

  const name = pack?.record.name ?? ''
  const hasEmoji = emojiCount === undefined || emojiCount > 0

  const remove = (alsoItems: boolean) => {
    if (!pack) return
    setProgress(undefined)
    progressControl.open()
    deletePack(
      {
        pack,
        deleteItems: alsoItems,
        onProgress: (done, total) => setProgress({done, total}),
      },
      {
        onSuccess: () => progressControl.close(onDeleted),
        onError: () => progressControl.close(),
      },
    )
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

      <Dialog.Outer control={progressControl} preventDismiss>
        <Dialog.ScrollableInner
          label={l`Deleting ${name}`}
          style={web({maxWidth: 320})}>
          <View style={[a.align_center, a.gap_lg, a.py_5xl]}>
            <Loader size="xl" />
            <Text
              style={[a.text_lg, a.text_center, t.atoms.text_contrast_high]}>
              {l`Deleting ${name}…`}
            </Text>
            {progress && progress.total > 0 ? (
              <>
                <View
                  style={[
                    a.w_full,
                    a.rounded_full,
                    a.overflow_hidden,
                    {height: 6},
                    t.atoms.bg_contrast_25,
                  ]}>
                  <View
                    style={[
                      a.h_full,
                      a.rounded_full,
                      {
                        width: progressWidth(progress),
                        backgroundColor: t.palette.primary_500,
                      },
                    ]}
                  />
                </View>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {l`${progress.done} of ${progress.total}…`}
                </Text>
              </>
            ) : null}
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}

function progressWidth({done, total}: {done: number; total: number}) {
  const percent = Math.min(100, Math.round((done / total) * 100))
  return `${percent}%`
}
