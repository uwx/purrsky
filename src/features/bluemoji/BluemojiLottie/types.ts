/** Props shared by both platform implementations. */
export type BluemojiLottieProps = {
  /** `com.atproto.sync.getBlob` URL on the PDS that holds the item. */
  uri: string
  /** Side of the square the animation is drawn in, in points. */
  size: number
  autoplay: boolean
  /** The emoji's alias, for screen readers. */
  label?: string
  testID?: string
  /** Fired when the animation cannot be loaded or drawn. */
  onError?: () => void
}

export type InlineLottieProps = BluemojiLottieProps & {
  /** Nudges the animation off the text baseline, as `InlineImage` does. */
  baselineOffset?: number
}
