import {useState} from 'react'
import {Pressable} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useAutoplayDisabled} from '#/state/preferences'
import {useBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {web} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Portal} from '#/components/Portal'
import * as Tooltip from '#/components/Tooltip'
import {IS_NATIVE} from '#/env'
import {BluemojiDetails} from '#/features/bluemoji/BluemojiDetails'
import {InlineLottie} from '#/features/bluemoji/BluemojiLottie'
import {InlineImage} from '#/features/bluemoji/InlineImage'
import {
  useBluemojiItemQuery,
  useBluemojiLottieUrl,
} from '#/features/bluemoji/queries'
import {
  type BluemojiRef,
  getBluemojiImage,
  getBluemojiModeration,
} from '#/features/bluemoji/util'

export function InlineBluemoji({
  claim,
  fallbackText,
  size,
  baselineOffset,
  interactive = true,
}: {
  claim: BluemojiRef
  fallbackText: string
  size: number
  baselineOffset?: number
  interactive?: boolean
}) {
  const {t: l} = useLingui()
  const detailsControl = Dialog.useDialogControl()
  const [visible, setVisible] = useState(false)
  const {data: item} = useBluemojiItemQuery(claim)
  const opts = useModerationOpts()
  const autoplayDisabled = useAutoplayDisabled()
  const instance = useBluemojiInstance()
  const [failedUri, setFailedUri] = useState<string>()
  const lottieUri = useBluemojiLottieUrl(item ?? undefined)
  const shown =
    item && getBluemojiModeration(item, opts) === 'ignore' ? item : undefined
  const imageUri = shown && getBluemojiImage(shown, instance)
  /* Either rendition can be the item's only one, and either can fail. */
  const uri = shown
    ? [imageUri, lottieUri].find(u => u && u !== failedUri)
    : undefined
  if (!uri || !shown) return fallbackText
  const alt = shown.record.alt?.trim() || shown.record.name
  const media =
    uri === imageUri ? (
      <InlineImage
        testID="inlineBluemoji"
        source={{uri}}
        accessibilityLabel={alt}
        accessibilityHint={undefined}
        size={size}
        baselineOffset={baselineOffset}
        contentFit="contain"
        autoplay={!autoplayDisabled}
        onError={() => setFailedUri(uri)}
      />
    ) : (
      <InlineLottie
        testID="inlineBluemoji"
        uri={uri}
        size={size}
        baselineOffset={baselineOffset}
        autoplay={!autoplayDisabled}
        label={alt}
        onError={() => setFailedUri(uri)}
      />
    )
  if (!interactive) return media
  if (IS_NATIVE) {
    return (
      <>
        <Pressable
          testID="bluemojiDetails"
          style={{width: size, height: size}}
          accessibilityRole="button"
          accessibilityLabel={
            alt === shown.record.name ? alt : `${shown.record.name} ${alt}`
          }
          accessibilityHint={l`Show emoji details`}
          onPress={event => {
            event.stopPropagation()
            detailsControl.open()
          }}>
          {media}
        </Pressable>
        <Portal>
          <Dialog.Outer
            control={detailsControl}
            nativeOptions={{preventExpansion: true}}>
            <Dialog.Handle />
            <Dialog.ScrollableInner label={l`Emoji details`}>
              <BluemojiDetails item={shown} alt={alt} />
            </Dialog.ScrollableInner>
          </Dialog.Outer>
        </Portal>
      </>
    )
  }
  return (
    <Tooltip.Outer visible={visible} onVisibleChange={setVisible}>
      <Tooltip.Target
        style={web({display: 'inline-block', verticalAlign: 'baseline'})}>
        <Button
          testID="bluemojiDetails"
          label={
            alt === shown.record.name ? alt : `${shown.record.name} ${alt}`
          }
          accessibilityHint={l`Show emoji details`}
          style={web({display: 'inline-block', verticalAlign: 'baseline'})}
          onPress={event => {
            event.preventDefault()
            event.stopPropagation()
            setVisible(!visible)
          }}>
          {media}
        </Button>
      </Tooltip.Target>
      <Tooltip.Content label={l`Emoji details`}>
        <BluemojiDetails item={shown} alt={alt} />
      </Tooltip.Content>
    </Tooltip.Outer>
  )
}
