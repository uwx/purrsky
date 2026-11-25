import {Text} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {
  Provider,
  useLocalAltTextEnabled,
} from '#/state/preferences/local-alt-text'

const mockPref = {stored: true as boolean | undefined, aiConfigured: false}

jest.mock('#/state/persisted', () => ({
  get: () => mockPref.stored,
  write: jest.fn(() => Promise.resolve()),
  onUpdate: () => () => {},
}))
jest.mock('#/state/preferences/openrouter', () => ({
  useAltTextAiConfigured: () => mockPref.aiConfigured,
}))

/*
 * The legacy iOS build has no react-native-executorch to call, so the
 * preference has to resolve to false there whatever is stored - otherwise the
 * composer renders a button that fails when pressed. Kept in its own file
 * because jest.mock is hoisted, so the flag is set before the preference
 * module is evaluated.
 */
jest.mock('#/env', () => ({
  ...jest.requireActual('#/env'),
  IS_LEGACY_IOS: true,
}))

function Probe() {
  return <Text>{String(useLocalAltTextEnabled())}</Text>
}

it('is off on the iOS 16 build even when it is stored on', () => {
  render(
    <Provider>
      <Probe />
    </Provider>,
  )

  expect(screen.getByText('false')).toBeTruthy()
})
