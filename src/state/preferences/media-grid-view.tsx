import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['mediaGridView']
type SetContext = (v: persisted.Schema['mediaGridView']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.mediaGridView,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['mediaGridView']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('mediaGridView'))

  const setStateWrapped = useCallback(
    (value: persisted.Schema['mediaGridView']) => {
      setState(value)
      void persisted.write('mediaGridView', value)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('mediaGridView', next => {
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

/** Whether feeds and profile media tabs show only media, as a tile grid. */
export function useMediaGridView() {
  return useContext(stateContext)
}

export function useSetMediaGridView() {
  return useContext(setContext)
}
