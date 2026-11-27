import {useEffect} from 'react'
import {Text, View} from 'react-native'
import {type ModerationUI} from '@bsky/sdk/moderation'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {ContentHider} from './ContentHider'

let mockBlurHiddenAttachments = true
const mockOpenDetails = jest.fn()
const mockMount = jest.fn()

jest.mock('#/state/preferences/blur-hidden-attachments', () => ({
  useBlurHiddenAttachments: () => mockBlurHiddenAttachments,
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => true,
}))
jest.mock('#/state/preferences', () => ({
  useLabelDefinitions: () => ({labelDefs: {}}),
}))
jest.mock('#/lib/moderation/useGlobalLabelStrings', () => ({
  useGlobalLabelStrings: () => ({}),
}))
jest.mock('#/lib/moderation/useLabelInfo', () => ({}))
jest.mock('#/lib/moderation/useModerationCauseDescription', () => ({
  useModerationCauseDescription: () => ({
    name: 'Content warning',
    icon: require('react-native').View,
  }),
}))
jest.mock('#/components/moderation/ModerationDetailsDialog', () => ({
  ModerationDetailsDialog: () => null,
  useModerationDetailsDialogControl: () => ({open: mockOpenDetails}),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  native: () => undefined,
  web: () => undefined,
  useBreakpoints: () => ({gtMobile: false}),
  useTheme: () => ({atoms: {text_contrast_medium: {color: 'gray'}}}),
}))
jest.mock('#/components/Typography', () => ({
  Text: require('react-native').Text,
}))
jest.mock('#/components/Button', () => ({
  Button: ({children, label, ...props}: any) => {
    const {Pressable} = require('react-native')
    return (
      <Pressable accessibilityLabel={label} {...props}>
        {typeof children === 'function' ? children({}) : children}
      </Pressable>
    )
  },
}))

function Player() {
  useEffect(() => {
    mockMount()
  }, [])
  return <Text>Actual attachment</Text>
}

function renderWarning({
  preview = true,
  noOverride = false,
  blurs = true,
} = {}) {
  const modui = {
    blurs: blurs ? [{type: 'muted', source: {type: 'user'}}] : [],
    noOverride,
  } as unknown as ModerationUI
  return render(
    <I18nProvider i18n={i18n}>
      <ContentHider
        modui={modui}
        hiddenPreview={preview ? <View testID="blurredPreview" /> : undefined}>
        <Player />
      </ContentHider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  mockBlurHiddenAttachments = true
  mockOpenDetails.mockClear()
  mockMount.mockClear()
})

it('keeps the attachment unmounted until its blurred preview is revealed', () => {
  const screen = renderWarning()
  expect(screen.getByTestId('blurredPreview')).toBeTruthy()
  expect(mockMount).not.toHaveBeenCalled()
  expect(screen.getByText('Hidden')).toBeTruthy()
  expect(screen.queryByText('Show')).toBeNull()
  expect(screen.queryByLabelText('Content warning')).toBeNull()

  fireEvent.press(screen.getByLabelText('Show hidden media'), {
    preventDefault() {},
    stopPropagation() {},
  })
  expect(screen.queryByTestId('blurredPreview')).toBeNull()
  expect(screen.getByText('Actual attachment')).toBeTruthy()
  expect(mockMount).toHaveBeenCalledTimes(1)

  expect(screen.queryByText('Hidden')).toBeNull()
  expect(screen.queryByText('Hide')).toBeNull()
  expect(screen.queryByLabelText('Content warning')).toBeNull()
})

it('keeps warnings collapsed when the option is disabled', () => {
  mockBlurHiddenAttachments = false
  const screen = renderWarning()
  expect(screen.queryByTestId('blurredPreview')).toBeNull()
  expect(screen.getByText('Show')).toBeTruthy()
  expect(mockMount).not.toHaveBeenCalled()
})

it('does not preview or reveal content whose moderation forbids overriding', () => {
  const screen = renderWarning({noOverride: true})
  expect(screen.queryByTestId('blurredPreview')).toBeNull()
  fireEvent.press(screen.getByLabelText('Content warning'), {
    preventDefault() {},
    stopPropagation() {},
  })
  expect(mockOpenDetails).toHaveBeenCalledTimes(1)
  expect(mockMount).not.toHaveBeenCalled()
})

it('does not change whole-post warnings without attachment previews', () => {
  const screen = renderWarning({preview: false})
  expect(screen.queryByLabelText('Show hidden media')).toBeNull()
  expect(mockMount).not.toHaveBeenCalled()
})

it('shows ordinary attachments immediately without adding a blurred preview', () => {
  const screen = renderWarning({blurs: false})
  expect(screen.queryByTestId('blurredPreview')).toBeNull()
  expect(screen.getByText('Actual attachment')).toBeTruthy()
})
