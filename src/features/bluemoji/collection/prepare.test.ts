import {compressImageSource} from '#/lib/media/image/compress'
import {readImageHeader} from '#/lib/media/image/read-header'
import {compressIfNeeded} from '#/lib/media/manip'
import {type PickerImage} from '#/lib/media/picker.shared'
import {prepareEmojiImage} from '#/features/bluemoji/collection/prepare'

jest.mock('#/lib/media/manip', () => ({
  compressIfNeeded: jest.fn((image: PickerImage) => Promise.resolve(image)),
}))
jest.mock('#/lib/media/image/compress', () => ({
  compressImageSource: jest.fn((image: PickerImage) =>
    Promise.resolve({...image, path: '/tmp/still.png'}),
  ),
}))
jest.mock('#/lib/media/image/read-header', () => ({readImageHeader: jest.fn()}))

/**
 * A PNG prefix of `size` bytes. `animated` decides whether the `acTL` chunk,
 * which is what makes it an APNG, is present.
 */
function header(size: number, {animated} = {animated: true}) {
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  // IHDR: length 13, type, 13 bytes of data, CRC.
  bytes.set([0, 0, 0, 13], 8)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  if (animated) {
    // acTL: length 8, type, 8 bytes of data, CRC.
    bytes.set([0, 0, 0, 8], 33)
    bytes.set([0x61, 0x63, 0x54, 0x4c], 37)
  } else {
    // IDAT instead, which ends the sniffer's walk.
    bytes.set([0x49, 0x44, 0x41, 0x54], 37)
  }
  return bytes
}

const picked: PickerImage = {
  path: '/tmp/cat.png',
  mime: 'image/png',
  width: 300,
  height: 300,
  size: 1000,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(readImageHeader).mockResolvedValue(header(45))
})

it('keeps an animated file whose bytes fit the slot untouched', async () => {
  const prepared = await prepareEmojiImage(picked)

  // No re-encode: that is exactly what used to flatten the animation.
  expect(prepared.image).toBe(picked)
  expect(prepared.rendition).toBe('apng_128')
  expect(prepared.still).toMatchObject({path: '/tmp/still.png'})
  expect(prepared.flattened).toBeUndefined()
  expect(compressIfNeeded).not.toHaveBeenCalled()
})

it('flattens an animation that is over the blob cap', async () => {
  jest.mocked(readImageHeader).mockResolvedValue(header(128_001))

  const prepared = await prepareEmojiImage(picked)

  expect(prepared.rendition).toBe('png_128')
  expect(prepared.flattened).toBe('size')
  expect(prepared.still).toBeUndefined()
  expect(compressIfNeeded).toHaveBeenCalledWith(
    picked,
    expect.objectContaining({maxSize: 128_000}),
  )
})

it('sends a still image through the resizer with no warning', async () => {
  jest.mocked(readImageHeader).mockResolvedValue(header(45, {animated: false}))

  const prepared = await prepareEmojiImage(picked)

  expect(prepared).toMatchObject({image: picked, rendition: 'png_128'})
  expect(prepared.flattened).toBeUndefined()
  expect(compressIfNeeded).toHaveBeenCalledTimes(1)
})

it('treats an unreadable header as a still rather than guessing', async () => {
  jest.mocked(readImageHeader).mockResolvedValue(undefined)

  const prepared = await prepareEmojiImage(picked)

  expect(prepared.rendition).toBe('png_128')
  expect(compressIfNeeded).toHaveBeenCalledTimes(1)
})

it('still uploads the animation when the first frame cannot be drawn', async () => {
  jest.mocked(compressImageSource).mockRejectedValue(new Error('no decoder'))

  const prepared = await prepareEmojiImage(picked)

  expect(prepared).toMatchObject({image: picked, rendition: 'apng_128'})
  expect(prepared.still).toBeUndefined()
})
