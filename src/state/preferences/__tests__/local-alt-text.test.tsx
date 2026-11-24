import {Text} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {
  Provider,
  useLocalAltTextEnabled,
} from '#/state/preferences/local-alt-text'

const mockPref = {stored: undefined as boolean | undefined, aiConfigured: false}

jest.mock('#/state/persisted', () => ({
  get: () => mockPref.stored,
  write: jest.fn(() => Promise.resolve()),
  onUpdate: () => () => {},
}))
jest.mock('#/state/preferences/openrouter', () => ({
  useAltTextAiConfigured: () => mockPref.aiConfigured,
}))

function Probe() {
  return <Text>{String(useLocalAltTextEnabled())}</Text>
}

function resolve() {
  render(
    <Provider>
      <Probe />
    </Provider>,
  )
  return screen.getByText(/^(true|false)$/).props.children as string
}

it('defaults on when no hosted provider is configured', () => {
  mockPref.stored = undefined
  mockPref.aiConfigured = false
  expect(resolve()).toBe('true')
})

it('defaults off when a hosted provider is configured', () => {
  mockPref.stored = undefined
  mockPref.aiConfigured = true
  expect(resolve()).toBe('false')
})

it('respects an explicit choice either way', () => {
  mockPref.aiConfigured = false
  mockPref.stored = false
  expect(resolve()).toBe('false')

  mockPref.aiConfigured = true
  mockPref.stored = true
  expect(resolve()).toBe('true')
})
