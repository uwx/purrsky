import {useState} from 'react'
import {View} from 'react-native'
import {BlurView} from 'expo-blur'
import {Image} from 'expo-image'

import {android, atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type Embed, parseEmbed} from '#/types/bsky/post'
import {VideoEmbed} from './VideoEmbed'

/** Static previews never mount players, games, or interactive embeds before reveal. */
export function HiddenAttachmentPreview({
  embed,
  children,
  active = true,
}: {
  embed: Embed
  children?: React.ReactNode
  active?: boolean
}) {
  const t = useTheme()

  return (
    <View
      testID="hiddenAttachmentPreview"
      aria-hidden={active || undefined}
      accessibilityElementsHidden={active}
      importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}
      pointerEvents={active ? 'none' : 'auto'}
      style={[a.w_full, a.overflow_hidden, !children && t.atoms.bg_contrast_25]}>
      <View
        style={
          active && [web({filter: 'blur(10px)'}), android({filter: [{blur: 10}]})]
        }>
        {children ?? <PreviewContent embed={embed} />}
      </View>
      {active && IS_IOS && (
        <BlurView intensity={100} tint="default" style={[a.absolute, a.inset_0]} />
      )}
    </View>
  )
}

function PreviewContent({embed}: {embed: Embed}) {
  switch (embed.type) {
    case 'images':
      return <PreviewImages images={embed.view.images} />
    case 'gallery':
      return (
        <PreviewImages
          images={embed.view.items
            .filter(item => bsky.isType(app.bsky.embed.gallery.viewImage, item))
            .map(item => ({thumb: item.thumbnail, aspectRatio: item.aspectRatio}))}
        />
      )
    case 'video':
      return <VideoEmbed embed={embed.view} hidden />
    case 'link':
      return (
        <View>
          {embed.view.external.thumb && (
            <PreviewImage uri={embed.view.external.thumb} />
          )}
          <PreviewText
            title={embed.view.external.title}
            description={embed.view.external.description}
          />
        </View>
      )
    case 'feed':
    case 'list':
      return (
        <View>
          {embed.view.avatar && <PreviewImage uri={embed.view.avatar} />}
          <PreviewText
            title={
              embed.type === 'feed' ? embed.view.displayName : embed.view.name
            }
            description={embed.view.description}
          />
        </View>
      )
    case 'post':
      return (
        <View>
          <PreviewText
            title={embed.view.author.displayName || embed.view.author.handle}
            description={
              bsky.isType(app.bsky.feed.post, embed.view.value)
                ? embed.view.value.text
                : undefined
            }
          />
          {embed.view.embeds?.[0] && (
            <PreviewContent embed={parseEmbed(embed.view.embeds[0])} />
          )}
        </View>
      )
    case 'post_with_media':
      return <PreviewContent embed={embed.media} />
    default:
      return null
  }
}

function PreviewImage({
  uri,
  dimensions,
  fill = false,
}: {
  uri?: string
  dimensions?: {width: number; height: number}
  fill?: boolean
}) {
  const [loadedRatio, setLoadedRatio] = useState(1)
  const hasDimensions =
    dimensions && dimensions.width > 0 && dimensions.height > 0
  const aspectRatio = hasDimensions
    ? dimensions.width / dimensions.height
    : loadedRatio

  return (
    <Image
      source={uri ? {uri} : undefined}
      style={fill ? [a.w_full, a.h_full] : [a.w_full, {aspectRatio}]}
      contentFit="cover"
      accessibilityIgnoresInvertColors
      onLoad={event => {
        if (
          !fill &&
          !hasDimensions &&
          event.source.width > 0 &&
          event.source.height > 0
        ) {
          setLoadedRatio(event.source.width / event.source.height)
        }
      }}
    />
  )
}

/** Match the two-, three-, and four-image attachment grids without mounting controls. */
function PreviewImages({
  images,
}: {
  images: {thumb: string; aspectRatio?: {width: number; height: number}}[]
}) {
  if (images.length === 1) {
    return <PreviewImage uri={images[0].thumb} dimensions={images[0].aspectRatio} />
  }

  const visible = images.slice(0, 4)
  if (visible.length === 3) {
    return (
      <View style={[a.flex_row, a.gap_xs]}>
        <View style={[a.flex_1, a.aspect_square]}>
          <PreviewImage uri={visible[0].thumb} fill />
        </View>
        <View style={[a.flex_1, a.aspect_square, a.gap_xs]}>
          {visible.slice(1).map(image => (
            <View key={image.thumb} style={a.flex_1}>
              <PreviewImage uri={image.thumb} fill />
            </View>
          ))}
        </View>
      </View>
    )
  }

  const rows =
    visible.length === 4 ? [visible.slice(0, 2), visible.slice(2)] : [visible]
  return (
    <View style={a.gap_xs}>
      {rows.map((row, index) => (
        <View key={index} style={[a.flex_row, a.gap_xs]}>
          {row.map(image => (
            <View
              key={image.thumb}
              style={[a.flex_1, {aspectRatio: visible.length === 4 ? 1.5 : 1}]}>
              <PreviewImage uri={image.thumb} fill />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function PreviewText({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <View style={[a.p_lg, a.gap_sm]}>
      <Text emoji style={a.font_bold} numberOfLines={2}>
        {title}
      </Text>
      {description ? (
        <Text emoji numberOfLines={3}>
          {description}
        </Text>
      ) : null}
    </View>
  )
}
