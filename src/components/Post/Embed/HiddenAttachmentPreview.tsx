import {View} from 'react-native'
import {BlurView} from 'expo-blur'
import {Image} from 'expo-image'

import {android, atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type Embed, parseEmbed} from '#/types/bsky/post'

/** Static previews never mount players, games, or interactive embeds before reveal. */
export function HiddenAttachmentPreview({embed}: {embed: Embed}) {
  const t = useTheme()

  return (
    <View
      testID="hiddenAttachmentPreview"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[a.w_full, a.overflow_hidden, t.atoms.bg_contrast_25]}>
      <View
        style={[web({filter: 'blur(10px)'}), android({filter: [{blur: 10}]})]}>
        <PreviewContent embed={embed} />
      </View>
      {IS_IOS && (
        <BlurView intensity={100} tint="default" style={[a.absolute, a.inset_0]} />
      )}
    </View>
  )
}

function PreviewContent({embed}: {embed: Embed}) {
  switch (embed.type) {
    case 'images':
      return (
        <View style={[a.flex_row, a.overflow_hidden]}>
          {embed.view.images.slice(0, 4).map(image => (
            <PreviewImage key={image.thumb} uri={image.thumb} grid />
          ))}
        </View>
      )
    case 'gallery':
      return (
        <View style={[a.flex_row, a.overflow_hidden]}>
          {embed.view.items
            .filter(item => bsky.isType(app.bsky.embed.gallery.viewImage, item))
            .slice(0, 4)
            .map((item, index) => (
              <PreviewImage key={index} uri={item.thumbnail} grid />
            ))}
        </View>
      )
    case 'video':
      return <PreviewImage uri={embed.view.thumbnail} />
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

function PreviewImage({uri, grid}: {uri?: string; grid?: boolean}) {
  return (
    <Image
      source={uri ? {uri} : undefined}
      style={[grid ? a.flex_1 : a.w_full, {aspectRatio: 1, maxHeight: 300}]}
      contentFit="cover"
      accessibilityIgnoresInvertColors
    />
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
