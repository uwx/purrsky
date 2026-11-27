import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'

const stateContext = createContext(false)
const setContext = createContext<(value: boolean) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(
    persisted.get('blurHiddenAttachments') ?? false,
  )

  function setStateWrapped(value: boolean) {
    setState(value)
    void persisted.write('blurHiddenAttachments', value)
  }

  useEffect(() => {
    return persisted.onUpdate('blurHiddenAttachments', value => {
      setState(value ?? false)
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useBlurHiddenAttachments() {
  return useContext(stateContext)
}

export function useSetBlurHiddenAttachments() {
  return useContext(setContext)
}
