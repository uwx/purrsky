import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'
import {useAltTextAiConfigured} from '#/state/preferences/openrouter'

const stateContext = createContext(false)
const setContext = createContext<(value: boolean) => void>(() => {})

/**
 * Whether the composer offers on-device alt text generation. An unset
 * preference follows the hosted provider: without one, on-device is the only
 * way to generate, so it stays on until the user turns it off.
 */
export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(persisted.get('localAltTextEnabled'))
  const aiConfigured = useAltTextAiConfigured()

  function setStateWrapped(value: boolean) {
    setState(value)
    void persisted.write('localAltTextEnabled', value)
  }

  useEffect(() => {
    return persisted.onUpdate('localAltTextEnabled', value => {
      setState(value)
    })
  }, [])

  return (
    <stateContext.Provider value={state ?? !aiConfigured}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useLocalAltTextEnabled() {
  return useContext(stateContext)
}

export function useSetLocalAltTextEnabled() {
  return useContext(setContext)
}
