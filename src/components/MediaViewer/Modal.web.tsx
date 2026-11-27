import {useEffect, useId, useRef} from 'react'
import {useLingui} from '@lingui/react/macro'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import * as FocusGuards from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {
  useDialogStateContext,
  useDialogStateControlContext,
} from '#/state/dialogs'
import {useComposerState} from '#/state/shell/composer'
import {atoms as a, flattenToCSS} from '#/alf'
import {type DialogControlRefProps} from '#/components/Dialog/types'
import {Portal} from '#/components/Portal'

const HISTORY_KEY = 'mediaViewer'
const preventDefault = (event: Event) => event.preventDefault()

export function ViewerModal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const {t: l} = useLingui()
  const id = useId()
  const {setDialogIsOpen} = useDialogStateControlContext()
  const {activeDialogs} = useDialogStateContext()
  const composer = useComposerState()
  const composerOpen = !!composer && !composer.isMinimized
  const close = useNonReactiveCallback(onClose)
  const invokingElement = useRef<HTMLElement | null>(null)
  const viewerElement = useRef<HTMLDivElement | null>(null)
  const dialogControl = useRef<DialogControlRefProps>({
    open: () => viewerElement.current?.focus(),
    close: callback => {
      close()
      if (callback) setTimeout(callback)
    },
  })
  const openingUrl = useRef('')
  const historyLifecycle = useRef(0)
  FocusGuards.useFocusGuards()

  useEffect(() => {
    invokingElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    openingUrl.current = window.location.href
    activeDialogs.current.set(id, dialogControl)
    setDialogIsOpen(id, true)
    return () => {
      activeDialogs.current.delete(id)
      setDialogIsOpen(id, false)
    }
  }, [activeDialogs, id, setDialogIsOpen])

  useEffect(() => {
    const lifecycle = ++historyLifecycle.current
    const url = window.location.href
    // Preserve the router's state so our same-URL entry remains a feed entry.
    if (window.history.state?.[HISTORY_KEY] !== id) {
      window.history.pushState(
        {...window.history.state, [HISTORY_KEY]: id},
        '',
      )
    }
    let traversed = false
    const onPopState = () => {
      traversed = true
      close()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // Defer cleanup so Strict Mode can remount the same host, or navigation
      // can push its destination, before deciding whether this is still ours.
      queueMicrotask(() => {
        if (
          historyLifecycle.current === lifecycle &&
          !traversed &&
          window.history.state?.[HISTORY_KEY] === id &&
          window.location.href === url
        ) {
          window.history.back()
        }
      })
    }
  }, [close, id])

  return (
    <Portal>
      <RemoveScrollBar />
      <FocusScope.FocusScope
        loop
        trapped={!composerOpen}
        asChild
        onUnmountAutoFocus={event => {
          event.preventDefault()
          if (
            window.location.href === openingUrl.current &&
            invokingElement.current?.isConnected
          ) {
            invokingElement.current.focus({preventScroll: true})
          }
        }}>
        <div
          ref={viewerElement}
          role="dialog"
          aria-modal={!composerOpen}
          aria-label={l`Media viewer`}
          aria-hidden={composerOpen || undefined}
          tabIndex={-1}
          style={flattenToCSS([
            a.fixed,
            a.inset_0,
            a.z_10,
            a.flex,
            a.flex_col,
            {backgroundColor: '#000', overflow: 'hidden'},
            composerOpen && {visibility: 'hidden'},
          ])}>
          {!composerOpen && (
            // Keep the content mounted when the composer opens, but unregister
            // this layer so only the composer's layer can consume Escape.
            <DismissableLayer.DismissableLayer
              onInteractOutside={preventDefault}
              onFocusOutside={preventDefault}
              onDismiss={close}
              style={{display: 'none'}}
            />
          )}
          {children}
        </div>
      </FocusScope.FocusScope>
    </Portal>
  )
}
