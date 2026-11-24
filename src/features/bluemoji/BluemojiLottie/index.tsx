import {type ComponentRef, useEffect, useRef} from 'react'
import {View} from 'react-native'
import LottieView from 'lottie-react-native'

import type {BluemojiLottieProps, InlineLottieProps} from './types'

/**
 * The animated rendition of a bluemoji, drawn from its owner's PDS.
 *
 * `onError` is what lets a caller fall back to the emoji's alias: the blob can
 * be gone, and a record written by another implementation can point at a
 * document this player cannot draw.
 */
export function BluemojiLottie({
  uri,
  size,
  autoplay,
  label,
  testID,
  onError,
}: BluemojiLottieProps) {
  const view = useRef<ComponentRef<typeof LottieView>>(null)

  /* `autoPlay` is only read on mount, so a later preference change is imperative. */
  useEffect(() => {
    if (autoplay) view.current?.play()
    else view.current?.pause()
  }, [autoplay])

  return (
    <View
      testID={testID}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityHint={undefined}
      accessibilityRole="image"
      style={{width: size, height: size}}>
      <LottieView
        ref={view}
        source={{uri}}
        style={{width: size, height: size}}
        autoPlay={autoplay}
        loop
        resizeMode="contain"
        onAnimationFailure={() => onError?.()}
      />
    </View>
  )
}

/** Runs inline with text, on the same baseline as `InlineImage`. */
export function InlineLottie({
  size,
  baselineOffset,
  ...props
}: InlineLottieProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{translateY: baselineOffset ?? size * 0.05}],
      }}>
      <BluemojiLottie {...props} size={size} />
    </View>
  )
}
