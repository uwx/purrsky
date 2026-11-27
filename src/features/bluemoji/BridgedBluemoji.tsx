import {useState} from 'react'

import {useAutoplayDisabled} from '#/state/preferences'
import {useBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {InlineImage} from '#/features/bluemoji/InlineImage'

/** Wafrn embeds its uploaded emoji as a post facet, without a collection item. */
export function BridgedBluemoji({
  did,
  cid,
  name,
  size,
  baselineOffset,
}: {
  did: string
  cid: string
  name: string
  size: number
  baselineOffset?: number
}) {
  const instance = useBluemojiInstance()
  const autoplayDisabled = useAutoplayDisabled()
  const [failed, setFailed] = useState(false)
  if (failed) return name
  const uri = `${instance}/img/${encodeURIComponent(did)}/${encodeURIComponent(cid)}`
  return (
    <InlineImage
      testID="inlineBluemoji"
      source={{uri}}
      accessibilityLabel={name}
      size={size}
      baselineOffset={baselineOffset}
      contentFit="contain"
      autoplay={!autoplayDisabled}
      onError={() => setFailed(true)}
    />
  )
}
