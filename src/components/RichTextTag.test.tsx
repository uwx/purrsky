import {render} from '@testing-library/react-native'

import {RichTextTag} from '#/components/RichTextTag'

type LinkProps = {gradient?: {colors: string[]}}

let linkProps: LinkProps | undefined

jest.mock('#/alf', () => ({
  useTheme: () => ({scheme: 'light', atoms: {text_contrast_high: {}}}),
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: (message: {message: string}) => message.message,
  }),
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({push: jest.fn()}),
}))
jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: () => ({data: undefined}),
  useRemoveMutedWordsMutation: () => ({mutate: jest.fn()}),
  useUpsertMutedWordsMutation: () => ({mutate: jest.fn()}),
}))
jest.mock('#/components/Link', () => ({
  createStaticClick: () => ({onPress: jest.fn()}),
  createStaticClickIfUnmodified: () => ({onPress: jest.fn()}),
  InlineLinkText: (props: LinkProps) => {
    linkProps = props
    return null
  },
}))
jest.mock('#/components/Menu', () => ({
  Root: ({children}: {children: React.ReactNode}) => children,
  Trigger: ({
    children,
  }: {
    children: (args: {props: Record<string, unknown>}) => React.ReactNode
  }) => children({props: {}}),
  Outer: () => null,
  Group: () => null,
  Item: () => null,
  ItemText: () => null,
  ItemIcon: () => null,
}))

beforeEach(() => {
  linkProps = undefined
})

it('paints a hashtag with its flag gradient', () => {
  render(<RichTextTag tag="Trans" display="#Trans" textStyle={{}} />)

  expect(linkProps?.gradient?.colors).toHaveLength(5)
})

it('leaves tags without a gradient on the theme link color', () => {
  render(<RichTextTag tag="witchsky" display="#witchsky" textStyle={{}} />)

  expect(linkProps?.gradient).toBeUndefined()
})

it('does not paint cashtags', () => {
  render(<RichTextTag tag="$trans" display="$trans" textStyle={{}} />)

  expect(linkProps?.gradient).toBeUndefined()
})
