import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {isInvalidHandle} from '#/lib/strings/handles'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {DeletePackPrompt} from './DeletePackPrompt'
import {PackCard} from './PackCard'
import {PackFormDialog} from './PackFormDialog'
import {useOwnPacksQuery} from './queries'
import {type BluemojiPack} from './util'

/**
 * The viewer's packs on the Custom emoji screen, where both emoji and packs are
 * created. Tapping a pack opens it; the menu edits or deletes it.
 */
export function PacksSection() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()
  const {data, isPending} = useOwnPacksQuery()
  const formControl = Dialog.useDialogControl()
  const deletePrompt = Prompt.usePromptControl()
  const [editing, setEditing] = useState<BluemojiPack | undefined>()

  const packs = data?.packs ?? []
  const counts = data?.counts ?? {}
  const authorName =
    currentAccount && !isInvalidHandle(currentAccount.handle)
      ? currentAccount.handle
      : (currentAccount?.did ?? '')

  return (
    <View style={[a.gap_md, a.p_md]}>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        <Text style={[a.text_md, a.font_semi_bold]}>
          <Trans>Emoji packs</Trans>
        </Text>
        <Button
          color="secondary"
          size="small"
          label={l`Create a pack`}
          onPress={() => {
            setEditing(undefined)
            formControl.open()
          }}>
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>New pack</Trans>
          </ButtonText>
        </Button>
      </View>

      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          A pack groups emoji you made or collected so others can add the whole
          set at once. People can find your packs on your profile.
        </Trans>
      </Text>

      {isPending ? null : packs.length === 0 ? (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>You have not made any packs yet.</Trans>
        </Text>
      ) : (
        <View style={[a.gap_xs]}>
          {packs.map(pack => (
            <View key={pack.uri} style={[a.flex_row, a.align_center, a.gap_xs]}>
              <View style={[a.flex_1]}>
                <PackCard
                  pack={pack}
                  count={counts[pack.uri] ?? 0}
                  name={authorName}
                />
              </View>
              <Menu.Root>
                <Menu.Trigger label={l`Pack actions for ${pack.record.name}`}>
                  {({props}) => (
                    <Button
                      {...props}
                      label={l`Pack actions for ${pack.record.name}`}
                      color="secondary"
                      size="small"
                      shape="square">
                      <ButtonIcon icon={EllipsisIcon} size="sm" />
                    </Button>
                  )}
                </Menu.Trigger>
                <Menu.Outer>
                  <Menu.Item
                    label={l`Edit pack`}
                    onPress={() => {
                      setEditing(pack)
                      formControl.open()
                    }}>
                    <Menu.ItemText>
                      <Trans>Edit details</Trans>
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={PencilIcon} position="right" />
                  </Menu.Item>
                  <Menu.Item
                    label={l`Delete pack`}
                    onPress={() => {
                      setEditing(pack)
                      deletePrompt.open()
                    }}>
                    <Menu.ItemText>
                      <Trans>Delete pack</Trans>
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={TrashIcon} position="right" />
                  </Menu.Item>
                </Menu.Outer>
              </Menu.Root>
            </View>
          ))}
        </View>
      )}

      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Open a pack to add or remove emoji, or to share it as a post.
        </Trans>
      </Text>

      <Dialog.Outer control={formControl} onClose={() => setEditing(undefined)}>
        <Dialog.Handle />
        <PackFormDialog
          key={editing?.uri ?? 'new'}
          editing={editing}
          onDone={formControl.close}
        />
      </Dialog.Outer>

      <DeletePackPrompt
        control={deletePrompt}
        pack={editing}
        emojiCount={editing ? (counts[editing.uri] ?? 0) : undefined}
        onDeleted={() => setEditing(undefined)}
      />
    </View>
  )
}
