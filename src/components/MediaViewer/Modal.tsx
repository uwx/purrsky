import {useEffect} from 'react'
import {BackHandler, View} from 'react-native'
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import {useLingui} from '@lingui/react/macro'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useDialogStateContext} from '#/state/dialogs'
import {useComposerState} from '#/state/shell/composer'
import {atoms as a} from '#/alf'
import {Portal} from '#/components/Portal'

export function ViewerModal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const {t: l} = useLingui()
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const {activeDialogs, openDialogs} = useDialogStateContext()
  const composer = useComposerState()
  const composerOpen = !!composer && !composer.isMinimized
  const close = useNonReactiveCallback(onClose)
  const handleBack = useNonReactiveCallback(() => {
    if (composerOpen) return false

    let topDialog: string | undefined
    for (const dialogId of openDialogs.current) topDialog = dialogId
    if (topDialog) {
      activeDialogs.current.get(topDialog)?.current.close()
      return true
    }

    close()
    return true
  })

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBack,
    )
    return () => {
      subscription.remove()
    }
  }, [handleBack])

  return (
    <Portal>
      <SafeAreaFrameContext.Provider value={frame}>
        <SafeAreaInsetsContext.Provider value={insets}>
          <View
            accessibilityLabel={l`Media viewer`}
            accessibilityViewIsModal={!composerOpen}
            importantForAccessibility={
              composerOpen ? 'no-hide-descendants' : 'auto'
            }
            onAccessibilityEscape={close}
            style={[
              a.absolute,
              a.inset_0,
              {backgroundColor: '#000'},
              composerOpen && {display: 'none'},
            ]}>
            {children}
          </View>
        </SafeAreaInsetsContext.Provider>
      </SafeAreaFrameContext.Provider>
    </Portal>
  )
}
