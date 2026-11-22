import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['disableProfileThemes']
type SetContext = (v: persisted.Schema['disableProfileThemes']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.disableProfileThemes,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['disableProfileThemes']) => {},
)

/**
 * Viewer preference: ignore the theme an account picked for its profile
 * (`profileTheme` in the decorations record) and paint the profile with the
 * viewer's own theme instead. The profile itself is unaffected; only the
 * colors around it change.
 */
export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('disableProfileThemes'))

  const setStateWrapped = useCallback(
    (value: persisted.Schema['disableProfileThemes']) => {
      setState(value)
      void persisted.write('disableProfileThemes', value)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('disableProfileThemes', next => {
      setState(next)
    })
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useDisableProfileThemes() {
  return useContext(stateContext)
}

export function useSetDisableProfileThemes() {
  return useContext(setContext)
}
