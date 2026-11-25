import {msg} from '@lingui/core/macro'
import {fireEvent, render} from '@testing-library/react-native'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {type DecorationFrame} from '#/features/avatarDecorations/catalog'

const frame = (id: string, name: string, color: string): DecorationFrame => ({
  id,
  name: msg`${name}`,
  color,
})

jest.mock('#/state/preferences/enable-square-avatars', () => ({
  useEnableSquareAvatars: () => true,
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => true,
}))
jest.mock('#/state/preferences/image-cdn-host', () => ({
  useImageCdnHost: () => undefined,
  applyImageTransforms: (uri: string) => uri,
}))
jest.mock('#/state/preferences/thumbnail-format', () => ({
  useThumbnailFormat: () => 'default',
}))
jest.mock('#/alf', () => ({
  atoms: {rounded_md: {borderRadius: 8}},
  useTheme: () => ({
    scheme: 'light',
    atoms: {
      border_contrast_low: {borderColor: '#ccc'},
      border_contrast_high: {borderColor: '#333'},
    },
    palette: {contrast_25: '#222', primary_500: '#f00'},
  }),
  platform: ({native}: {native: unknown}) => native,
}))
jest.mock('#/features/themes/accentForeground', () => ({
  accentForeground: () => '#fff',
}))
jest.mock('#/lib/haptics', () => ({}))
jest.mock('#/lib/hooks/usePermissions', () => ({}))
jest.mock('#/lib/media/manip', () => ({}))
jest.mock('#/lib/media/picker', () => ({}))
jest.mock('#/state/gallery', () => ({}))
jest.mock('#/state/queries/unstable-profile-cache', () => ({}))
jest.mock('#/view/com/composer/photos/EditImageDialog', () => ({}))
jest.mock('#/components/Button', () => ({}))
jest.mock('#/components/Dialog', () => ({}))
jest.mock('#/components/Dialog/sheet-wrapper', () => ({}))
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/Menu', () => ({}))
jest.mock('#/components/ProfileHoverCard', () => ({}))
jest.mock('#/analytics', () => ({}))
jest.mock('#/features/avatarDecorations', () => {
  const ring = jest.requireActual<{
    AvatarDecorationRing: React.ComponentType<{frame: DecorationFrame}>
  }>('#/features/avatarDecorations/AvatarDecorationRing')
  const hexagon = jest.requireActual<{
    HexagonAvatar: React.ComponentType<Record<string, unknown>>
  }>('#/features/avatarDecorations/HexagonAvatar')
  return {
    AvatarDecorationRing: ring.AvatarDecorationRing,
    HexagonAvatar: hexagon.HexagonAvatar,
    useAvatarDecoration: () => undefined,
    useAvatarShape: () => undefined,
    useAnimatedAvatar: (
      did: string | undefined,
      preset: string,
      playable: boolean,
    ) => {
      mockAnimatedCalls.push([did, preset, playable])
      return mockSavedAnimated
    },
  }
})
jest.mock('expo-image', () => {
  const react: typeof import('react') = jest.requireActual('react')
  const rn: typeof import('react-native') = jest.requireActual('react-native')
  return {Image: (props: Record<string, unknown>) => react.createElement(rn.Image, props)}
})
jest.mock('#/features/liveNow', () => ({}))
jest.mock('#/features/liveNow/components/LiveIndicator', () => ({}))
jest.mock('#/features/liveNow/components/LiveStatusDialog', () => ({}))

const avatar = 'https://example.com/avatar.jpg'
const stillUri = 'https://cdn.example.com/still.png'
const playUri = 'https://pds.example.com/animation.gif'

let mockSavedAnimated: {
  playUri?: string
  stillUri: string
  cid: string
} | undefined

const mockAnimatedCalls: [string | undefined, string, boolean][] = []

beforeEach(() => {
  mockSavedAnimated = undefined
  mockAnimatedCalls.length = 0
})

it('draws a decoration ring instead of a plain border', () => {
  const {getByTestId, queryByTestId} = render(
    <UserAvatar
      type="user"
      size={40}
      avatar={avatar}
      usePlainRNImage
      decoration={frame('gold-ring', 'Gold', '#FFD700')}
    />,
  )

  expect(getByTestId('avatarDecorationRing')).toHaveStyle({
    borderColor: '#FFD700',
  })
  expect(queryByTestId('avatarHexagonBorder')).toBeNull()
})

it.each(['hexagon', 'triangle'] as const)(
  'clips a %s avatar and strokes it with the frame color',
  profileShape => {
    const {getByTestId, queryByTestId} = render(
      <UserAvatar
        type="user"
        size={40}
        avatar={avatar}
        usePlainRNImage
        profileShape={profileShape}
        decoration={frame('flame-ring', 'Flame', '#F2571F')}
      />,
    )

    // The ring overlay cannot follow a polygon, so the stroke moves onto the
    // path.
    expect(queryByTestId('avatarDecorationRing')).toBeNull()
    expect(getByTestId('avatarHexagonBorder')).toBeTruthy()
    expect(getByTestId('avatarHexagonBorder')).toHaveProp('stroke', '#F2571F')
  },
)

it('never decorates a blurred avatar', () => {
  const {queryByTestId} = render(
    <UserAvatar
      type="user"
      size={40}
      avatar={avatar}
      usePlainRNImage
      moderation={{blur: true} as never}
      decoration={frame('gold-ring', 'Gold', '#FFD700')}
      profileShape="hexagon"
    />,
  )

  expect(queryByTestId('avatarDecorationRing')).toBeNull()
  expect(queryByTestId('avatarHexagonBorder')).toBeNull()
})

it('plays a stored animation instead of the profile picture', () => {
  mockSavedAnimated = {playUri, stillUri, cid: 'bafkreiassed'}
  const {getByTestId} = render(
    <UserAvatar type="user" size={48} avatar={avatar} did="did:plc:owner" />,
  )
  const image = getByTestId('userAvatarImage')
  expect(image).toHaveProp('source', {uri: playUri})
  expect(image).toHaveProp('autoplay', true)
})

it('shows the still first frame when motion must not play', () => {
  // useAnimatedAvatar leaves playUri unset when the device reduces motion or
  // the owner PDS is not known yet; the still is safe either way.
  mockSavedAnimated = {stillUri, cid: 'bafkreiassed'}
  const {getByTestId} = render(
    <UserAvatar type="user" size={48} avatar={avatar} did="did:plc:owner" />,
  )
  const image = getByTestId('userAvatarImage')
  expect(image).toHaveProp('source', {uri: stillUri})
  expect(image).toHaveProp('autoplay', false)
})

it('falls back from a broken animation to the still, then the picture', () => {
  mockSavedAnimated = {playUri, stillUri, cid: 'bafkreiassed'}
  const {getByTestId} = render(
    <UserAvatar type="user" size={48} avatar={avatar} did="did:plc:owner" />,
  )
  const image = getByTestId('userAvatarImage')

  fireEvent(image, 'error')
  expect(image).toHaveProp('source', {uri: stillUri})

  fireEvent(image, 'error')
  expect(image).toHaveProp('source', {uri: avatar})
})

it('does not look up playback where motion cannot be seen', () => {
  const cases = [
    {size: 24, props: {}},
    {size: 48, props: {profileShape: 'hexagon' as const}},
    {size: 48, props: {profileShape: 'triangle' as const}},
    {size: 48, props: {moderation: {blur: true} as never}},
  ]

  for (const {size, props} of cases) {
    mockAnimatedCalls.length = 0
    render(
      <UserAvatar
        type="user"
        size={size}
        avatar={avatar}
        did="did:plc:owner"
        {...props}
      />,
    )
    expect(mockAnimatedCalls).toEqual([
      ['did:plc:owner', size < 90 ? 'avatar_thumbnail' : 'avatar', false],
    ])
  }
})

it('requests playback for a visible animated avatar', () => {
  render(
    <UserAvatar type="user" size={48} avatar={avatar} did="did:plc:owner" />,
  )
  expect(mockAnimatedCalls).toEqual([['did:plc:owner', 'avatar_thumbnail', true]])
})
