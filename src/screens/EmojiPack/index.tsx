import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useRichText} from '#/lib/hooks/useRichText'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {shareUrl} from '#/lib/sharing'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/Arrow'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {EmojiHeartEyes_Stroke2_Corner0_Rounded as BluemojiIcon} from '#/components/icons/Emoji'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {BluemojiDetails} from '#/features/bluemoji/BluemojiDetails'
import {DeletePackPrompt} from '#/features/bluemoji/packs/DeletePackPrompt'
import {useCopyPackToCollectionMutation} from '#/features/bluemoji/packs/mutations'
import {PackFormDialog} from '#/features/bluemoji/packs/PackFormDialog'
import {PackItemsDialog} from '#/features/bluemoji/packs/PackItemsDialog'
import {
  usePackContentsQuery,
  usePackQuery,
} from '#/features/bluemoji/packs/queries'
import {getPackIconUrl, packShareUrl} from '#/features/bluemoji/packs/util'
import {Tile, TileGrid} from '#/features/bluemoji/Picker'
import {
  getLicenseUrl,
  getSafeSourceUrl,
  isCopyableLicense,
} from '#/features/bluemoji/provenance'
import {
  type BluemojiItem,
  getBluemojiModeration,
} from '#/features/bluemoji/util'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'EmojiPack'>

export function EmojiPackScreen({route, navigation}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {name, rkey} = route.params
  const {currentAccount, hasSession} = useSession()
  const {openComposer} = useOpenComposer()
  const moderationOpts = useModerationOpts()
  const {data: did, error: didError} = useResolveDidQuery(name)
  const packQuery = usePackQuery({did, rkey})
  const pack = packQuery.data
  const contents = usePackContentsQuery(pack)
  const {data: creator} = useProfileQuery({did: pack?.did})
  const isOwner = Boolean(pack && currentAccount?.did === pack.did)
  const [descriptionRT] = useRichText(pack?.record.description ?? '')

  const formControl = Dialog.useDialogControl()
  const itemsControl = Dialog.useDialogControl()
  const detailsControl = Dialog.useDialogControl()
  const deletePrompt = Prompt.usePromptControl()
  const [editing, setEditing] = useState(false)
  const [details, setDetails] = useState<BluemojiItem | null>(null)
  const copy = useCopyPackToCollectionMutation()
  const [progress, setProgress] = useState(0)

  const items = contents.data?.items ?? []
  const memberships = contents.data?.memberships ?? []
  const copyable = items.filter(item =>
    isCopyableLicense(item.record.license),
  ).length
  const adultHidden =
    Boolean(pack?.record.adultOnly) &&
    !moderationOpts?.prefs.adultContentEnabled
  const authorName = creator?.handle ?? pack?.did ?? name

  const sharePack = () => {
    if (!pack) return
    void shareUrl(packShareUrl(name, rkey))
  }

  /*
   * The composer resolves its text for links, so opening it with the pack URL
   * attaches the card that other clients show as a plain link.
   */
  const shareAsPost = () => {
    if (!pack) return
    openComposer({
      text: packShareUrl(name, rkey),
      logContext: 'Other',
    })
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {pack?.record.name ?? l`Emoji pack`}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {pack ? (
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <Button
              label={l`Share this pack`}
              size="small"
              color="secondary"
              shape="square"
              onPress={sharePack}>
              <ButtonIcon icon={ShareIcon} size="sm" />
            </Button>
            {isOwner ? (
              <Menu.Root>
                <Menu.Trigger label={l`Open pack actions`}>
                  {({props}) => (
                    <Button
                      {...props}
                      label={l`Open pack actions`}
                      size="small"
                      color="secondary"
                      shape="square">
                      <ButtonIcon icon={EllipsisIcon} size="sm" />
                    </Button>
                  )}
                </Menu.Trigger>
                <Menu.Outer>
                  <Menu.Item
                    label={l`Edit pack`}
                    onPress={() => {
                      setEditing(true)
                      formControl.open()
                    }}>
                    <Menu.ItemText>
                      <Trans>Edit details</Trans>
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={PencilIcon} position="right" />
                  </Menu.Item>
                  <Menu.Item label={l`Delete pack`} onPress={deletePrompt.open}>
                    <Menu.ItemText>
                      <Trans>Delete pack</Trans>
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={TrashIcon} position="right" />
                  </Menu.Item>
                </Menu.Outer>
              </Menu.Root>
            ) : null}
          </View>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>

      <Layout.Content>
        {packQuery.isPending && !pack ? (
          <View style={[a.p_5xl, a.align_center]}>
            <Loader size="xl" />
          </View>
        ) : !pack ? (
          <View style={[a.p_xl, a.gap_sm]}>
            <Text style={[a.text_md, a.font_semi_bold]}>
              <Trans>This pack could not be loaded.</Trans>
            </Text>
            <Text style={[t.atoms.text_contrast_medium]}>
              {didError
                ? l`We could not find that account.`
                : l`It may have been deleted, or its owner's server is unreachable.`}
            </Text>
          </View>
        ) : (
          <View style={[a.px_lg, a.py_lg, a.gap_lg]}>
            <View style={[a.flex_row, a.align_start, a.gap_md]}>
              <View
                style={[
                  a.rounded_md,
                  a.overflow_hidden,
                  a.align_center,
                  a.justify_center,
                  {width: 72, height: 72},
                  t.atoms.bg_contrast_25,
                ]}>
                {getPackIconUrl(pack) ? (
                  <Image
                    source={{uri: getPackIconUrl(pack)}}
                    contentFit="cover"
                    style={{width: 72, height: 72}}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <BluemojiIcon size="xl" fill={t.palette.primary_500} />
                )}
              </View>
              <View style={[a.flex_1, a.gap_2xs]}>
                <Text emoji style={[a.text_xl, a.font_bold, a.leading_snug]}>
                  {pack.record.name}
                </Text>
                <InlineLinkText
                  label={l`Open ${sanitizeHandle(authorName, '@')}'s profile`}
                  to={{screen: 'Profile', params: {name: pack.did}}}
                  style={[a.text_sm]}>
                  {sanitizeHandle(authorName, '@')}
                </InlineLinkText>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {l`${String(items.length)} emoji`}
                  {pack.record.adultOnly ? ` · ${l`Adult content`}` : ''}
                </Text>
              </View>
            </View>

            {pack.record.description ? (
              <RichText
                value={descriptionRT}
                style={[a.text_md, a.leading_snug]}
                authorHandle={creator?.handle}
                enableTags
              />
            ) : null}

            <PackProvenance
              source={pack.record.source}
              license={pack.record.license}
            />

            <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
              {isOwner ? (
                <>
                  <Button
                    color="primary"
                    size="small"
                    label={l`Add emoji to this pack`}
                    onPress={() => {
                      if (contents.isPending) return
                      itemsControl.open()
                    }}>
                    <ButtonIcon icon={PlusIcon} />
                    <ButtonText>
                      <Trans>Add emoji</Trans>
                    </ButtonText>
                  </Button>
                  <Button
                    color="secondary"
                    size="small"
                    label={l`Edit pack details`}
                    onPress={() => {
                      setEditing(true)
                      formControl.open()
                    }}>
                    <ButtonText>
                      <Trans>Edit details</Trans>
                    </ButtonText>
                  </Button>
                </>
              ) : (
                <Button
                  color="primary"
                  size="small"
                  disabled={!copyable || copy.isPending}
                  label={l`Add these emoji to my collection`}
                  onPress={() => {
                    setProgress(0)
                    copy.mutate({
                      items,
                      onProgress: setProgress,
                    })
                  }}>
                  <ButtonText>
                    {copy.isPending
                      ? l`Adding ${progress}/${items.length}…`
                      : copyable
                        ? l`Add all to my emoji`
                        : l`No emoji in this pack can be copied`}
                  </ButtonText>
                </Button>
              )}
              {hasSession ? (
                <Button
                  color="secondary"
                  size="small"
                  label={l`Share this pack as a post`}
                  onPress={shareAsPost}>
                  <ButtonIcon icon={ShareIcon} />
                  <ButtonText>
                    <Trans>Share as post</Trans>
                  </ButtonText>
                </Button>
              ) : null}
            </View>

            {contents.isPending ? (
              <View style={[a.py_5xl, a.align_center]}>
                <Loader size="lg" />
              </View>
            ) : items.length === 0 ? (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {isOwner ? (
                  <Trans>This pack is empty. Add some of your emoji.</Trans>
                ) : (
                  <Trans>This pack does not have any emoji yet.</Trans>
                )}
              </Text>
            ) : adultHidden ? (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  This pack is marked as adult content. Turn on adult content in
                  your moderation settings to see it.
                </Trans>
              </Text>
            ) : (
              <TileGrid>
                {items.map(item =>
                  getBluemojiModeration(item, moderationOpts) ===
                  'hide' ? null : (
                    <Tile
                      key={item.uri}
                      label={item.record.name}
                      item={item}
                      onPress={() => {
                        setDetails(item)
                        detailsControl.open()
                      }}
                    />
                  ),
                )}
              </TileGrid>
            )}

            {isOwner ? (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  Only emoji you own can be in your pack, and others can only
                  add an emoji whose licence allows it.
                </Trans>
              </Text>
            ) : null}
          </View>
        )}
      </Layout.Content>

      {pack ? (
        <>
          <Dialog.Outer control={formControl}>
            <Dialog.Handle />
            <PackFormDialog
              key={editing ? 'edit' : 'new'}
              editing={editing ? pack : undefined}
              onDone={formControl.close}
            />
          </Dialog.Outer>
          <Dialog.Outer control={itemsControl}>
            <Dialog.Handle />
            <PackItemsDialog
              pack={pack}
              memberships={memberships}
              onDone={itemsControl.close}
            />
          </Dialog.Outer>
          <Dialog.Outer control={detailsControl}>
            <Dialog.Handle />
            {details ? (
              <Dialog.ScrollableInner label={l`Emoji details`}>
                <BluemojiDetails
                  item={details}
                  alt={details.record.alt || details.record.name}
                />
                <Dialog.Close />
              </Dialog.ScrollableInner>
            ) : null}
          </Dialog.Outer>
          <DeletePackPrompt
            control={deletePrompt}
            pack={pack}
            emojiCount={memberships.length}
            onDeleted={() => navigation.goBack()}
          />
        </>
      ) : null}
    </Layout.Screen>
  )
}

function PackProvenance({
  source,
  license,
}: {
  source?: string
  license?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const sourceUrl = getSafeSourceUrl(source)
  const licenseName = license?.trim()
  const licenseUrl = getLicenseUrl(licenseName)
  if (!sourceUrl && !licenseName) return null
  return (
    <View style={[a.gap_2xs]}>
      {sourceUrl ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Source:</Trans>{' '}
          <InlineLinkText
            to={sourceUrl}
            label={l`Open the original artwork`}
            style={[a.text_sm]}>
            {sourceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </InlineLinkText>
        </Text>
      ) : null}
      {licenseName ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>License:</Trans>{' '}
          {licenseUrl ? (
            <InlineLinkText
              to={licenseUrl}
              label={l`Read the license terms`}
              style={[a.text_sm]}>
              {licenseName}
            </InlineLinkText>
          ) : (
            licenseName
          )}
        </Text>
      ) : null}
    </View>
  )
}
