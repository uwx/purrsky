import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {render} from '@testing-library/react-native'

type LinkProps = {to: string}

let mockLinkTargets: string[] = []

jest.mock('#/alf', () => ({
  atoms: {text_sm: {fontSize: 14}, flex_row: {}},
  useTheme: () => ({atoms: {}, palette: {}}),
  useAlf: () => ({fonts: {scaleMultiplier: 1}}),
  flatten: (style: unknown) =>
    Object.assign(
      {},
      ...((Array.isArray(style) ? style.flat(Infinity) : [style]) as object[]).filter(
        Boolean,
      ),
    ),
  android: () => ({}),
}))
jest.mock('#/alf/util/dimensions', () => ({
  useNativeFontScale: () => 1,
}))
jest.mock('#/env', () => ({IS_NATIVE: false, IS_ANDROID: false}))
jest.mock('#/components/Link', () => ({
  InlineLinkText: (props: LinkProps & {children?: React.ReactNode}) => {
    mockLinkTargets.push(props.to)
    return props.children ?? null
  },
}))
jest.mock('#/components/ProfileHoverCard', () => ({
  ProfileHoverCard: ({children}: {children: React.ReactNode}) => children,
}))
jest.mock('#/components/RichTextTag', () => ({
  RichTextTag: () => null,
}))
jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text, default: Text}
})
jest.mock('#/features/bluemoji/InlineBluemoji', () => ({
  InlineBluemoji: () => null,
}))
jest.mock('#/features/bluemoji/richText', () => ({
  isOnlyEmojiRichText: () => false,
}))
jest.mock('#/features/bluemoji/util', () => ({
  getBluemojiFacet: () => false,
}))
jest.mock('#/features/pollblue/parse', () => ({stripPollLines: (t: string) => t}))

import {RichText} from '#/components/RichText'

function richTextWithLink(uri: string) {
  const text = 'click here'
  const rt = new RichTextAPI({text})
  rt.facets = [
    {
      index: {byteStart: 0, byteEnd: new TextEncoder().encode(text).length},
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: uri as `${string}:${string}`,
        },
      ],
    },
  ]
  return rt
}

beforeEach(() => {
  mockLinkTargets = []
})

it('renders a link facet with a genuine host as a link', () => {
  render(<RichText value={richTextWithLink('https://example.com/a')} />)
  expect(mockLinkTargets).toEqual(['https://example.com/a'])
})

it.each(['https://...', 'https://', 'https://example.com.', 'at://did:x/y'])(
  'renders a facet with a degenerate host as plain text: %s',
  uri => {
    render(<RichText value={richTextWithLink(uri)} />)
    expect(mockLinkTargets).toEqual([])
  },
)
