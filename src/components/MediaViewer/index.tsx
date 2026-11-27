import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {AtUri} from '@atproto/syntax'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {resolveEmbedImageUris} from '#/lib/media/embed-image-formats'
import {getRecordImageMimeType} from '#/lib/media/recordImageMimeType'
import {makeProfileLink} from '#/lib/routes/links'
import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useFullsizeFormat} from '#/state/preferences/fullsize-format'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useLoadAsPngs} from '#/state/preferences/load-small-pngs'
import {PostThread} from '#/screens/PostThread'
import {atoms as a, ThemeProvider, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/TimesLarge'
import {ScrollbarOffsetContext} from '#/components/Layout/context'
import {Link} from '#/components/Link'
import * as ReportDialogMetadata from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {PostControls} from '#/components/PostControls'
import {Text} from '#/components/Typography'
import {FeedItemProvider} from '#/features/feedFeedback'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {ImagePager} from './ImagePager'
import {ViewerModal} from './Modal'

/** Fullscreen media, with post context kept separate from its attachments. */
export function MediaViewer({
  post,
  moderation,
  images,
  initialIndex,
  onClose,
}: {
  post: app.bsky.feed.defs.PostView
  moderation: ModerationDecision
  images: app.bsky.embed.images.ViewImage[]
  initialIndex: number
  onClose: () => void
}) {
  return (
    <ViewerModal onClose={onClose}>
      <ThemeProvider theme="dark">
        <ReportDialogMetadata.Provider>
          <FeedItemProvider
            value={{
              uri: post.uri,
              authorDid: post.author.did,
              feedContext: undefined,
              reqId: undefined,
              via: undefined,
            }}>
            <ViewerContent
              post={post}
              moderation={moderation}
              images={images}
              initialIndex={initialIndex}
              onClose={onClose}
            />
          </FeedItemProvider>
        </ReportDialogMetadata.Provider>
      </ThemeProvider>
    </ViewerModal>
  )
}

function ViewerContent({
  post,
  moderation,
  images,
  initialIndex,
  onClose,
}: React.ComponentProps<typeof MediaViewer>) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const insets = useSafeAreaInsets()
  const square = useEnableSquareButtons()
  const fullsizeFormat = useFullsizeFormat()
  const loadAsPngs = useLoadAsPngs()
  const imageCdnHost = useImageCdnHost()
  const {openComposer} = useOpenComposer()
  const shadow = usePostShadow(post)
  const record = bsky.isType(app.bsky.feed.post.main, post.record)
    ? post.record
    : undefined
  const richText = new RichTextAPI({
    text: record?.text ?? '',
    facets: record?.facets,
  })
  const postHref = makeProfileLink(post.author, 'post', new AtUri(post.uri).rkey)
  const sources = images.map(image => {
    const {fullsize} = resolveEmbedImageUris(
      {
        ...image,
        mimeType: getRecordImageMimeType(image.fullsize, post.record),
      },
      {fullsizeFormat: fullsizeFormat ?? 'default', loadAsPngs: loadAsPngs ?? true},
    )
    return {
      uri: applyImageTransforms(fullsize, {imageCdnHost}),
      alt: image.alt,
      aspectRatio: image.aspectRatio,
    }
  })
  const media = bsky.isType(app.bsky.embed.recordWithMedia.view, post.embed)
    ? post.embed.media
    : post.embed
  const threadgateRecord = bsky.isType(
    app.bsky.feed.threadgate.main,
    post.threadgate?.record,
  )
    ? post.threadgate.record
    : undefined

  function reply() {
    if (!record) return
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text,
        author: post.author,
        embed: post.embed,
        moderation,
        langs: record.langs,
      },
      logContext: 'PostReply',
    })
  }

  const postControls =
    shadow !== POST_TOMBSTONE && record ? (
      <View
        testID="mediaViewerControls"
        style={[
          a.w_full,
          a.flex_shrink,
          a.self_center,
          {maxWidth: 640, minWidth: 0},
        ]}>
        <PostControls
          post={shadow}
          record={record}
          richText={richText}
          onPressReply={reply}
          threadgateRecord={threadgateRecord}
          logContext="Post"
          variant={gtMobile ? 'normal' : 'compact'}
        />
      </View>
    ) : (
      <Text>
        <Trans>This post is no longer available.</Trans>
      </Text>
    )

  return (
    <View
      testID="mediaViewer"
      style={[
        a.flex_1,
        a.flex_row,
        t.atoms.bg,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      <View style={[a.flex_1, {minWidth: 0}]}>
        <View style={[a.flex_1, a.relative, {minHeight: 0}]}>
          {sources.length ? (
            <ImagePager
              images={sources}
              initialIndex={initialIndex}
              onClose={onClose}
              toolbarCenter={
                gtMobile ? (
                  postControls
                ) : (
                  <Link
                    label={l`View post`}
                    to={postHref}
                    color="secondary"
                    size="small">
                    <ButtonText>
                      <Trans>View post</Trans>
                    </ButtonText>
                  </Link>
                )
              }
            />
          ) : (
            <View style={[a.flex_1, a.justify_center]}>
              <Embed
                embed={media}
                post={post}
                moderation={moderation}
                viewContext={PostEmbedViewContext.ThreadHighlighted}
              />
            </View>
          )}
          <Button
            label={l`Close media viewer`}
            onPress={onClose}
            color="secondary"
            size="small"
            shape={square ? 'square' : 'round'}
            style={[a.absolute, {top: 12, left: 12}]}>
            <ButtonIcon icon={CloseIcon} />
          </Button>
        </View>
        {(!gtMobile || sources.length === 0) && (
          <View
            style={[
              a.px_md,
              a.py_sm,
              a.gap_sm,
              a.border_t,
              t.atoms.border_contrast_low,
            ]}>
            {!gtMobile && sources.length === 0 && (
              <Link
                label={l`View post`}
                to={postHref}
                color="secondary"
                size="small"
                style={a.self_center}>
                <ButtonText>
                  <Trans>View post</Trans>
                </ButtonText>
              </Link>
            )}
            {postControls}
          </View>
        )}
      </View>
      {gtMobile && (
        <View
          testID="mediaViewerPost"
          style={[
            a.border_l,
            t.atoms.border_contrast_low,
            {width: 380, flexGrow: 0, flexShrink: 0},
          ]}>
          <ScrollbarOffsetContext.Provider value={{isWithinOffsetView: true}}>
            <PostThread uri={post.uri} embedded hideAnchorAttachments />
          </ScrollbarOffsetContext.Provider>
        </View>
      )}
    </View>
  )
}
