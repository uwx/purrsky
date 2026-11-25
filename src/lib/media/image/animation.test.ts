import {detectAnimatedImage} from '#/lib/media/image/animation'

/**
 * 4x4 fixtures: two red/blue frames for the animated ones, a single red frame
 * for the stills. All are real encoder output except where noted.
 */
const fixtures = {
  apng: 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAEAAAABAAAAAAAAAAAAGQD6AAAvnNQ/AAAABVJREFUeJxj/M/A8J8BCTAxoAHCAgCD0QIGApDvWAAAABpmY1RMAAAAAQAAAAQAAAAEAAAAAAAAAAAAZAPoAAAlALooAAAAGWZkQVQAAAACeJxjZGD4/58BCTAxoAHCAgCB0wIGTKM7fwAAAABJRU5ErkJggg==',
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR4nGP8z8DwnwEJMDGgAcICAIPRAgYCkO9YAAAAAElFTkSuQmCC',
  gif2: 'R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7',
  gif1: 'R0lGODdhBAAEAIEAAP8AAAAAAAAAAAAAACwAAAAABAAEAAAICQABCBxIsCCAgAA7',
  webp2:
    'UklGRsQAAABXRUJQVlA4WAoAAAACAAAAAwAAAwAAQU5JTQYAAAAAAAAAAABBTk1GSgAAAAAAAAAAAAMAAAMAAGQAAAJWUDggMgAAADABAJ0BKgQABAABQCYloAADcAD+8ut///mwP/bz/wR6Af//0uD//pcH//S4P/SkAAAAQU5NRkYAAAAAAAAAAAADAAADAABkAAAAVlA4IC4AAAA0AQCdASoEAAQAAAAmJaAAA3AA/vtV4///S4P/+lwf/9Lg/9Lg//rV5Vesq6AA',
  webp1:
    'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoEAAQAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=',
}

function decode(base64: string) {
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

it('detects an APNG from its acTL chunk', () => {
  expect(detectAnimatedImage(decode(fixtures.apng))).toBe('apng')
})

it('treats an APNG whose acTL is past the read prefix as still', () => {
  const bytes = decode(fixtures.apng)
  // The signature and IHDR end at 33 bytes; acTL is the next chunk.
  expect(detectAnimatedImage(bytes.slice(0, 33))).toBeUndefined()
})

it('treats a plain PNG as still', () => {
  expect(detectAnimatedImage(decode(fixtures.png))).toBeUndefined()
})

it('detects a GIF with more than one frame', () => {
  expect(detectAnimatedImage(decode(fixtures.gif2))).toBe('gif')
})

it('treats a one-frame GIF as still', () => {
  expect(detectAnimatedImage(decode(fixtures.gif1))).toBeUndefined()
})

it('skips a local colour table instead of reading it as blocks', () => {
  // 0x2c is both the image-descriptor marker and a plausible palette byte; a
  // scanner that searched for it would count phantom frames.
  const descriptor = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x87]
  const palette = new Array(768).fill(0x2c)
  // LZW minimum code size, one data sub-block, terminator.
  const frame = [...descriptor, ...palette, 2, 1, 0x4c, 0]
  const header = [
    ...Buffer.from('GIF89a', 'ascii'),
    1,
    0,
    1,
    0,
    0x00, // no global colour table
    0,
    0,
    ...frame,
    ...frame,
    0x3b,
  ]
  expect(detectAnimatedImage(Uint8Array.from(header))).toBe('gif')
  expect(
    detectAnimatedImage(Uint8Array.from(header.slice(0, -frame.length - 1))),
  ).toBeUndefined()
})

it('detects an animated WebP from the VP8X animation flag', () => {
  expect(detectAnimatedImage(decode(fixtures.webp2))).toBe('webp')
})

it('treats a single-frame WebP as still', () => {
  expect(detectAnimatedImage(decode(fixtures.webp1))).toBeUndefined()
})

it('does not treat any other container as animated', () => {
  for (const value of ['', 'not an image', 'GIF8', 'RIFF']) {
    expect(
      detectAnimatedImage(new Uint8Array(Buffer.from(value, 'ascii'))),
    ).toBeUndefined()
  }
})
