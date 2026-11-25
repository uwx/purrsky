import {detectAnimatedImage} from '#/lib/media/image/animation'
import {compressImageSource} from '#/lib/media/image/compress'
import {readImageHeader} from '#/lib/media/image/read-header'
import {compressIfNeeded} from '#/lib/media/manip'
import {type PickerImage} from '#/lib/media/picker.shared'

/** `formats_v1.blob_v1` cap, in bytes. */
const MAX_RENDITION_BYTES = 128_000
/** Renders read a rendition into a 128px box. */
const RENDITION_DIMENSION = 128
/* One byte past the cap, so a file of exactly the cap reads untruncated. */
const HEADER_BYTES = MAX_RENDITION_BYTES + 1

/** Slots an emoji image can be written to, in `formats_v1`. */
export type EmojiRendition = 'png_128' | 'apng_128' | 'gif_128' | 'webp_128'

const ANIMATED_RENDITION = {
  apng: 'apng_128',
  gif: 'gif_128',
  webp: 'webp_128',
} as const

/** An emoji image ready to upload, and where its bytes belong. */
export type PreparedEmojiImage = {
  /** The bytes to upload into `rendition`. */
  image: PickerImage
  rendition: EmojiRendition
  /**
   * First frame as a still, so readers that only know `png_128` still draw
   * something. Absent when the source could not be decoded.
   */
  still?: PickerImage
  /** The source animated but had to be flattened to fit the rendition. */
  flattened?: 'size'
}

/**
 * Prepares a picked file for upload.
 *
 * Animated files must not go through the resizer: the manipulator decodes one
 * frame and re-encodes it, which is exactly how an APNG stops moving. Keeping
 * the original bytes and writing them to their format's slot is the only way
 * the record can say the emoji animates, since `formats_v1` has no flag for it.
 */
export async function prepareEmojiImage(
  image: PickerImage,
): Promise<PreparedEmojiImage> {
  const header = await readImageHeader(image.path, HEADER_BYTES)
  const animated = header ? detectAnimatedImage(header) : undefined
  /*
   * `readImageHeader` returns at most `HEADER_BYTES`, so anything longer than
   * the blob cap arrived truncated. Dimensions are not checked: an animated
   * file can be larger than 128px and still render fine, while the byte cap is
   * the only limit the lexicon enforces.
   */
  if (header && animated && header.length <= MAX_RENDITION_BYTES) {
    return {
      image,
      rendition: ANIMATED_RENDITION[animated],
      still: await renderStill(image),
    }
  }
  const compressed = await compressIfNeeded(image, {
    maxDimension: RENDITION_DIMENSION,
    maxSize: MAX_RENDITION_BYTES,
  })
  return {
    image: compressed,
    rendition: 'png_128',
    flattened: animated ? 'size' : undefined,
  }
}

/**
 * Draws the first frame at rendition size. Best effort: the animated slot is
 * the rendition that matters, and a still only fills in for older readers.
 */
async function renderStill(image: PickerImage) {
  try {
    return await compressImageSource(
      {
        path: image.path,
        width: image.width,
        height: image.height,
        mime: image.mime,
      },
      {maxDimension: RENDITION_DIMENSION, maxSize: MAX_RENDITION_BYTES},
    )
  } catch {
    return undefined
  }
}
