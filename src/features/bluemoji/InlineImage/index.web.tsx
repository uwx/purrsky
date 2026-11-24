import {Image, type ImageProps} from 'expo-image'

import {InlineSlot} from '#/features/bluemoji/InlineSlot.web'

export function InlineImage({
  size,
  baselineOffset: _baselineOffset,
  ...props
}: {size: number; baselineOffset?: number} & Omit<ImageProps, 'style'>) {
  return (
    <InlineSlot size={size}>
      <Image {...props} style={{width: '100%', height: '100%'}} />
    </InlineSlot>
  )
}
