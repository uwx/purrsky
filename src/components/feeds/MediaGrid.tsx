import {useRef} from 'react'
import {Pressable, View} from 'react-native'
import Animated, {
  type AnimatedRef,
  useAnimatedRef,
} from 'react-native-reanimated'
import {Image} from 'expo-image'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {getPostMediaDownloadName} from '#/lib/media/downloadFilename'
import {resolveEmbedImageUris} from '#/lib/media/embed-image-formats'
import {getRecordImageMimeType} from '#/lib/media/recordImageMimeType'
import {getShapeRadius} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useFullsizeFormat} from '#/state/preferences/fullsize-format'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useLargeAltBadgeEnabled} from '#/state/preferences/large-alt-badge'
import {useLoadAsPngs} from '#/state/preferences/load-small-pngs'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {
  type FeedDescriptor,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {type VideoFeedSourceContext} from '#/screens/VideoFeed/types'
import {atoms as a, tokens, useBreakpoints, useGutters, useTheme} from '#/alf'
import {
  type AspectRatioItem,
  packIntoStrips,
} from '#/components/feeds/mediaGridLayout'
import {useLightboxControls} from '#/components/Lightbox/state'
import {type Dimensions} from '#/components/Lightbox/types'
import {Link} from '#/components/Link'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import * as Hider from '#/components/moderation/Hider'
import {Text} from '#/components/Typography'
import {PlayButtonIcon} from '#/components/video/PlayButtonIcon'
import {IS_WEB} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/**
 * Columns of the media grid. Matches the video grid, so a feed's videos look
 * the same whichever view is showing them.
 */
export function useMediaGridColumns() {
  const {gtMobile} = useBreakpoints()
  return gtMobile ? 3 : 2
}

/**
 * One tile of the media grid. A post with several images becomes several
 * tiles, adjacent to each other.
 */
export type MediaGridItem = {
  /** Unique within the feed, stable across re-renders. */
  key: string
  post: app.bsky.feed.defs.PostView
  moderation: ModerationDecision
  kind: 'image' | 'video'
  /** Width divided by height, clamped to keep extreme crops out of the grid. */
  aspectRatio: number
  /** Index of this tile within the post's media, and how many there are. */
  index: number
  total: number
  /** The image this tile shows, when `kind` is 'image'. */
  image?: app.bsky.embed.images.ViewImage
  /** The video's poster frame, when `kind` is 'video'. */
  thumbnail?: string
}

/** The media of a post, including the media half of a record-with-media embed. */
function getMediaEmbed(embed: app.bsky.feed.defs.PostView['embed']) {
  return bsky.isType(app.bsky.embed.recordWithMedia.view, embed)
    ? embed.media
    : embed
}

function ratioOf(
  aspectRatio: {width: number; height: number} | null | undefined,
  fallback: number,
) {
  if (!aspectRatio || aspectRatio.width <= 0 || aspectRatio.height <= 0) {
    return fallback
  }
  return Math.min(Math.max(aspectRatio.width / aspectRatio.height, 0.5), 2)
}

/**
 * The image embeds of a post, with gallery entries normalized to the images
 * embed's shape.
 */
export function getPostImages(post: app.bsky.feed.defs.PostView) {
  const media = getMediaEmbed(post.embed)
  if (bsky.isType(app.bsky.embed.images.view, media)) {
    return media.images
  }
  if (bsky.isType(app.bsky.embed.gallery.view, media)) {
    const images: app.bsky.embed.images.ViewImage[] = []
    for (const item of media.items) {
      if (bsky.isType(app.bsky.embed.gallery.viewImage, item)) {
        images.push({
          thumb: item.thumbnail,
          fullsize: item.fullsize,
          alt: item.alt,
          aspectRatio: item.aspectRatio,
        })
      }
    }
    return images
  }
  return []
}

/**
 * The media tiles of a post, or an empty array when it has none. Posts with
 * filtered media are skipped: the feed queries usually drop those already.
 */
export function getMediaGridItems(item: FeedPostSliceItem): MediaGridItem[] {
  if (item.moderation.ui('contentMedia').filter) return []

  const post = item.post
  const media = getMediaEmbed(post.embed)

  if (bsky.isType(app.bsky.embed.video.view, media)) {
    return [
      {
        key: `${post.uri}:video`,
        post,
        moderation: item.moderation,
        kind: 'video',
        aspectRatio: ratioOf(media.aspectRatio, 9 / 16),
        index: 0,
        total: 1,
        thumbnail: media.thumbnail,
      },
    ]
  }

  const images = getPostImages(post)
  return images.map((image, index) => ({
    key: `${post.uri}:${index}`,
    post,
    moderation: item.moderation,
    kind: 'image',
    aspectRatio: ratioOf(image.aspectRatio, 1),
    index,
    total: images.length,
    image,
  }))
}

export function postHasGridMedia(post: app.bsky.feed.defs.PostView) {
  const media = getMediaEmbed(post.embed)
  return (
    bsky.isType(app.bsky.embed.video.view, media) ||
    getPostImages(post).length > 0
  )
}

/**
 * A block of the media grid: the media of a run of posts, rendered as one list
 * row. Every strip fills the row, and blocks are spaced by the same gap as the
 * tiles inside them, so consecutive blocks read as one continuous wall.
 */
export function MediaGridRow({
  items,
  feedDescriptor,
  sourceContext,
}: {
  items: FeedPostSliceItem[]
  feedDescriptor: FeedDescriptor
  sourceContext: VideoFeedSourceContext
}) {
  const columns = useMediaGridColumns()
  const gutters = useGutters([0, 'base', 0, 'base'])
  const tiles = items.flatMap(getMediaGridItems)

  if (tiles.length === 0) return null

  const strips = packIntoStrips(tiles, columns)

  return (
    <View style={[gutters, a.pb_2xs]}>
      <View style={a.gap_2xs}>
        {strips.map(strip => (
          <View key={strip[0].key} style={[a.flex_row, a.gap_2xs]}>
            {strip.map(tile => (
              <View key={tile.key} style={stripStyle(tile)}>
                <MediaGridTile
                  tile={tile}
                  feedDescriptor={feedDescriptor}
                  sourceContext={sourceContext}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

export function MediaGridRowPlaceholder() {
  const t = useTheme()
  const columns = useMediaGridColumns()
  const gutters = useGutters([0, 'base', 0, 'base'])
  const ratios = [3 / 4, 1, 4 / 3, 4 / 3, 1, 3 / 4, 1, 1, 1]
  const strips = packIntoStrips(
    ratios.map(aspectRatio => ({aspectRatio})),
    columns,
  )

  return (
    <View style={[gutters, a.pb_2xs]}>
      <View style={a.gap_2xs}>
        {strips.map((strip, stripIndex) => (
          <View key={stripIndex} style={[a.flex_row, a.gap_2xs]}>
            {strip.map((tile, tileIndex) => (
              <View key={tileIndex} style={stripStyle(tile)}>
                <View
                  style={[
                    t.atoms.bg_contrast_25,
                    a.rounded_sm,
                    {aspectRatio: tile.aspectRatio},
                  ]}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Gives a tile the share of the strip its aspect ratio asks for. Every tile in
 * a strip ends up the same height, because width grows with the ratio.
 */
function stripStyle({aspectRatio}: AspectRatioItem) {
  return {flexBasis: 0, flexGrow: aspectRatio, minWidth: 0}
}

function MediaGridTile({
  tile,
  feedDescriptor,
  sourceContext,
}: {
  tile: MediaGridItem
  feedDescriptor: FeedDescriptor
  sourceContext: VideoFeedSourceContext
}) {
  /*
   * Mirrors `VideoPostCard`: the row's own labels and the media's labels both
   * apply to a tile, and `Hider` only reads the merged UI.
   */
  const modui = tile.moderation.ui('contentList')
  const mediaModui = tile.moderation.ui('contentMedia')
  modui.alerts = [...modui.alerts, ...mediaModui.alerts]
  modui.blurs = [...modui.blurs, ...mediaModui.blurs]
  modui.filters = [...modui.filters, ...mediaModui.filters]
  modui.informs = [...modui.informs, ...mediaModui.informs]

  return (
    <Hider.Outer modui={modui}>
      <Hider.Mask>
        <MediaGridTileMask tile={tile} />
      </Hider.Mask>
      <Hider.Content>
        {tile.kind === 'video' ? (
          <MediaGridVideoTile tile={tile} sourceContext={sourceContext} />
        ) : (
          <MediaGridImageTile tile={tile} feedDescriptor={feedDescriptor} />
        )}
      </Hider.Content>
    </Hider.Outer>
  )
}

/**
 * Blur for thumbnails whose media is behind a moderation warning. On web this
 * is a CSS blur in pixels, so a native-sized radius would wash out the tile.
 */
const BLUR_RADIUS = IS_WEB ? 10 : 100

function MediaGridTileMask({tile}: {tile: MediaGridItem}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const hider = Hider.useHider()

  const uri =
    tile.kind === 'image'
      ? tile.image?.thumb
      : tile.kind === 'video'
        ? tile.thumbnail
        : undefined

  return (
    <Pressable
      onPress={() => {
        if (hider.meta.allowOverride) hider.setIsContentVisible(true)
      }}
      accessibilityRole="button"
      accessibilityLabel={l`Show hidden media`}
      accessibilityHint=""
      style={[
        a.justify_center,
        a.rounded_sm,
        a.overflow_hidden,
        t.atoms.bg_contrast_25,
        {aspectRatio: tile.aspectRatio},
      ]}>
      {uri ? (
        <Image
          source={{uri}}
          style={[a.w_full, a.h_full]}
          accessibilityIgnoresInvertColors
          blurRadius={BLUR_RADIUS}
        />
      ) : null}
      <MediaInsetBorder />
      <View style={[a.absolute, a.inset_0, a.justify_center, a.align_center]}>
        <Text style={[a.text_xs, a.font_semi_bold, {color: 'white'}]}>
          <Trans>Hidden</Trans>
        </Text>
      </View>
    </Pressable>
  )
}

function MediaGridVideoTile({
  tile,
  sourceContext,
}: {
  tile: MediaGridItem
  sourceContext: VideoFeedSourceContext
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const {thumbnail} = tile

  return (
    <Link
      to={{
        screen: 'VideoFeed',
        params: {...sourceContext, initialPostUri: tile.post.uri},
      }}
      label={l`Video from @${tile.post.author.handle}`}
      onPress={() => haptics.tap()}
      style={[
        a.justify_center,
        a.rounded_sm,
        a.overflow_hidden,
        t.atoms.bg_contrast_25,
        {aspectRatio: tile.aspectRatio},
      ]}>
      {thumbnail ? (
        <Image
          source={{uri: thumbnail}}
          style={[a.w_full, a.h_full]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <MediaInsetBorder />
      <View style={[a.absolute, a.inset_0, a.justify_center, a.align_center]}>
        <PlayButtonIcon size={24} />
      </View>
    </Link>
  )
}

function MediaGridImageTile({
  tile,
  feedDescriptor,
}: {
  tile: MediaGridItem
  feedDescriptor: FeedDescriptor
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const shapePreference = useEnableSquareButtons()
  const largeAltBadge = useLargeAltBadgeEnabled()
  const thumbnailFormat = useThumbnailFormat()
  const fullsizeFormat = useFullsizeFormat()
  const loadAsPngs = useLoadAsPngs()
  const imageCdnHost = useImageCdnHost()
  const {openLightbox} = useLightboxControls()
  const thumbRef = useAnimatedRef<Animated.View>()
  const thumbDims = useRef<Dimensions | null>(null)

  const {post, image} = tile
  const images = getPostImages(post)
  const borderRadius = getShapeRadius(
    shapePreference,
    tokens.borderRadius.sm,
    tokens.borderRadius.sm,
  )

  const open = () => {
    haptics.tap()
    openLightbox({
      images: images.map((img, index) => {
        const uris = resolveEmbedImageUris(
          {...img, mimeType: getRecordImageMimeType(img.fullsize, post.record)},
          {
            thumbnailFormat,
            fullsizeFormat: fullsizeFormat ?? 'default',
            loadAsPngs: loadAsPngs ?? true,
          },
        )
        return {
          uri: applyImageTransforms(uris.fullsize, {imageCdnHost}),
          thumbUri: applyImageTransforms(uris.thumb, {imageCdnHost}),
          downloadName: getPostMediaDownloadName(
            post,
            images.length > 1 ? index : undefined,
          ),
          dimensions: img.aspectRatio ?? null,
          /*
           * Only the tapped tile has a box to fly back to, the same tradeoff
           * `ImageEmbed` makes for screen-reader galleries.
           */
          thumbRef: index === tile.index ? (thumbRef as AnimatedRef) : null,
          thumbDimensions: index === tile.index ? thumbDims.current : null,
          thumbRect: null,
          thumbBorderRadius: borderRadius,
          alt: img.alt,
          type: 'image',
        }
      }),
      index: tile.index,
      metricsContext: {
        layout: 'grid',
        postUri: post.uri,
        postAuthorDid: post.author.did,
        feedDescriptor,
      },
    })
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={image?.alt || l`Image`}
      accessibilityHint=""
      style={[
        a.rounded_sm,
        a.overflow_hidden,
        t.atoms.bg_contrast_25,
        {aspectRatio: tile.aspectRatio},
      ]}>
      <Animated.View ref={thumbRef} collapsable={false} style={a.flex_1}>
        {image ? (
          <Image
            source={{
              uri: applyImageTransforms(image.thumb, {
                imageCdnHost,
                format: thumbnailFormat,
              }),
            }}
            style={a.flex_1}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            onLoad={e => {
              thumbDims.current = {
                width: e.source.width,
                height: e.source.height,
              }
            }}
            loading="lazy"
            useAppleWebpCodec
          />
        ) : null}
      </Animated.View>
      <MediaInsetBorder />
      {image?.alt ? (
        <View
          accessible={false}
          style={[
            a.absolute,
            a.flex_row,
            a.align_center,
            a.rounded_sm,
            a.p_xs,
            t.atoms.bg_contrast_25,
            {
              bottom: a.p_xs.padding,
              right: a.p_xs.padding,
              opacity: 0.8,
            },
            largeAltBadge && {padding: 6},
          ]}>
          <Text
            style={[a.font_bold, largeAltBadge ? a.text_xs : {fontSize: 8}]}>
            <Trans>ALT</Trans>
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
