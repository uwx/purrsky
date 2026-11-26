import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  useMediaGridView,
  useSetMediaGridView,
} from '#/state/preferences/media-grid-view'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {BulletList_Stroke2_Corner0_Rounded as ListIcon} from '#/components/icons/BulletList'
import {DotGrid2x3_Stroke2_Corner0_Rounded as GridIcon} from '#/components/icons/DotGrid'

/**
 * Switches a feed between its posts and its media grid. Lives at the end of a
 * tab bar, so it is one tap away without taking a tab slot.
 */
export function MediaGridToggle() {
  const {t: l} = useLingui()
  const mediaGridView = useMediaGridView()
  const setMediaGridView = useSetMediaGridView()
  const haptics = useHaptics()
  const square = useEnableSquareButtons()
  const next = !mediaGridView

  return (
    <Button
      label={next ? l`Show media grid` : l`Show posts`}
      onPress={() => {
        haptics.toggle(next)
        setMediaGridView(next)
      }}
      color="secondary"
      variant="ghost"
      size="small"
      shape={square ? 'square' : 'round'}
      hitSlop={4}
      style={[a.mx_2xs]}>
      <ButtonIcon icon={next ? GridIcon : ListIcon} size="md" />
    </Button>
  )
}
