/*
 * The repo registers a manual mock for multiformats/cid (__mocks__) that every
 * test picks up automatically. These tests exercise real CID parsing, so take
 * the real decoder.
 */
jest.unmock('multiformats/cid')

import {
  animatedAvatarPlayUrl,
  avatarBlobCid,
  avatarBlobStillUrl,
  checkAnimatedAvatar,
  isAnimatedAvatarMime,
  MAX_ANIMATED_AVATAR_BYTES,
  parseAnimatedAvatarBlob,
} from './animatedAvatar'

// A real CIDv1 so parseCidSafe accepts it.
const CID = 'bafkreiass37k5huajyfh6lzq6tndfhbsr6epvhoxz5diu4lj4rujcl3l4u'

describe('isAnimatedAvatarMime', () => {
  it('accepts the animated formats and a still PNG', () => {
    for (const mime of [
      'image/gif',
      'image/webp',
      'image/apng',
      'image/avif',
      'image/png',
      'IMAGE/GIF',
    ]) {
      expect(isAnimatedAvatarMime(mime)).toBe(true)
    }
  })

  it('refuses formats that cannot carry trusted animation', () => {
    expect(isAnimatedAvatarMime('image/svg+xml')).toBe(false)
    expect(isAnimatedAvatarMime('image/jpeg')).toBe(false)
    expect(isAnimatedAvatarMime(undefined)).toBe(false)
  })
})

describe('checkAnimatedAvatar', () => {
  it('accepts an allowed file under the cap', () => {
    expect(checkAnimatedAvatar({mime: 'image/gif', size: 1000})).toEqual({
      ok: true,
    })
  })

  it('rejects a disallowed type before looking at size', () => {
    expect(checkAnimatedAvatar({mime: 'image/svg+xml', size: 10})).toEqual({
      ok: false,
      reason: 'type',
    })
  })

  it('rejects a file over the cap, and an unknown size only if it is huge', () => {
    expect(
      checkAnimatedAvatar({
        mime: 'image/webp',
        size: MAX_ANIMATED_AVATAR_BYTES + 1,
      }),
    ).toEqual({ok: false, reason: 'size'})
    // Pickers that cannot measure report no size; the upload path enforces the
    // real limit, so this must not block the pick.
    expect(checkAnimatedAvatar({mime: 'image/webp'})).toEqual({ok: true})
  })
})

describe('parseAnimatedAvatarBlob', () => {
  it('reads the lex form a putRecord response returns', () => {
    const blob = parseAnimatedAvatarBlob({
      $type: 'blob',
      ref: {$link: CID},
      mimeType: 'image/gif',
      size: 2048,
    })
    expect(blob).toEqual({
      $type: 'blob',
      ref: expect.anything(),
      mimeType: 'image/gif',
      size: 2048,
    })
    expect(avatarBlobCid(blob)).toBe(CID)
  })

  it('reads the JSON form Slingshot returns', () => {
    const blob = parseAnimatedAvatarBlob({
      ref: {$link: CID},
      mimeType: 'image/webp',
      size: 128,
    })
    expect(avatarBlobCid(blob)).toBe(CID)
  })

  it('drops bytes this build will not render', () => {
    expect(
      parseAnimatedAvatarBlob({
        ref: {$link: CID},
        mimeType: 'image/svg+xml',
        size: 128,
      }),
    ).toBeUndefined()
    expect(
      parseAnimatedAvatarBlob({
        ref: {$link: CID},
        mimeType: 'image/gif',
        size: MAX_ANIMATED_AVATAR_BYTES + 1,
      }),
    ).toBeUndefined()
    expect(
      parseAnimatedAvatarBlob({
        ref: {$link: 'not-a-cid'},
        mimeType: 'image/gif',
        size: 1,
      }),
    ).toBeUndefined()
    expect(parseAnimatedAvatarBlob('nope')).toBeUndefined()
  })
})

describe('blob URLs', () => {
  it('asks the image CDN for a still PNG, whatever the source format', () => {
    expect(avatarBlobStillUrl('did:plc:owner', CID, 'avatar')).toBe(
      `https://cdn.bsky.app/img/avatar/plain/did:plc:owner/${CID}@png`,
    )
  })

  it('reads the bytes from the owner PDS so animation survives', () => {
    expect(
      animatedAvatarPlayUrl('https://pds.example.com', 'did:plc:owner', CID),
    ).toBe(
      `https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aowner&cid=${CID}`,
    )
  })

  it('has no play URL until the PDS is known', () => {
    expect(animatedAvatarPlayUrl(undefined, 'did:plc:owner', CID)).toBeUndefined()
    expect(animatedAvatarPlayUrl('nonsense', 'did:plc:owner', CID)).toBeUndefined()
  })
})
