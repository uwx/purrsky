import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'

import {useAutoplayDisabled} from '#/state/preferences'
import {useBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {usePdsServiceUrl} from '#/state/session'
import {BluemojiLottie} from '#/features/bluemoji/BluemojiLottie'
import {useBluemojiLottieUrl} from '#/features/bluemoji/queries'
import {
  type BluemojiItem,
  getBluemojiImage,
  getBluemojiPdsImage,
} from '#/features/bluemoji/util'

/**
 * An emoji rendition at a fixed size, falling back to the owning PDS if
 * moji.blue's CDN does not have the blob, and to the animation if the picture
 * is gone entirely.
 *
 * The CDN only serves blobs its index has seen, so an emoji uploaded moments
 * ago 404s there until the firehose catches up. The PDS serves it immediately,
 * and is where the CDN itself reads from.
 */
export function BluemojiImage({
  item,
  size,
  label,
}: {
  item: BluemojiItem
  size: number
  /** The emoji's alias; the image is otherwise decorative to a screen reader. */
  label?: string
}) {
  const [failedUri, setFailedUri] = useState<string>()
  const [fallbackUri, setFallbackUri] = useState<string>()
  const autoplayDisabled = useAutoplayDisabled()
  const pdsUrl = usePdsServiceUrl()
  const instance = useBluemojiInstance()
  const cdnUri = getBluemojiImage(item, instance)
  const rasterUri = fallbackUri ?? cdnUri
  const lottieUri = useBluemojiLottieUrl(item)
  /*
   * Animated emoji often have no raster slot at all, so the document is the
   * only rendition there is; either can be the one that fails.
   */
  const uri = [rasterUri, lottieUri].find(
    candidate => candidate && candidate !== failedUri,
  )

  return (
    <View style={{width: size, height: size}}>
      {uri && uri === rasterUri ? (
        <Image
          source={{uri}}
          contentFit="contain"
          cachePolicy="memory-disk"
          autoplay={!autoplayDisabled}
          style={{width: size, height: size}}
          accessibilityLabel={label}
          accessibilityHint={undefined}
          accessibilityIgnoresInvertColors
          onError={() => {
            /*
             * One retry, against the PDS. Its failure retires the picture and
             * leaves the animation as the last thing worth drawing.
             */
            if (!fallbackUri && cdnUri === uri && pdsUrl) {
              const next = getBluemojiPdsImage(item, pdsUrl)
              if (next) {
                setFallbackUri(next)
                return
              }
            }
            setFailedUri(uri)
          }}
        />
      ) : uri ? (
        <BluemojiLottie
          uri={uri}
          size={size}
          autoplay={!autoplayDisabled}
          label={label}
          onError={() => setFailedUri(uri)}
        />
      ) : null}
    </View>
  )
}
