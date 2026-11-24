import {cleanGeneratedAltText} from '#/lib/ai/generateAltText'
import {MAX_ALT_TEXT} from '#/lib/constants'
import {enforceLen} from '#/lib/strings/helpers'
import {type LocalAltTextProgress} from './protocol'

export {type LocalAltTextProgress, type LocalAltTextStage} from './protocol'

export type GenerateLocalAltTextOptions = {
  /** URI of the composer image. Local path, blob URL, or remote URL. */
  uri: string
  /** Intrinsic image dimensions, used to pick a downscale target. */
  width: number
  height: number
  /** Post languages in preference order. The first one is used. */
  languages: readonly string[]
  onProgress?: (progress: LocalAltTextProgress) => void
}

/**
 * Cleans a raw model reply and enforces the alt text limit. Also strips the
 * label some models prepend, which would otherwise be posted as alt text.
 */
export function finalizeLocalAltText(raw: string): string {
  const text = cleanGeneratedAltText(raw)
    .replace(/^(?:alt text|image description)\s*:\s*/i, '')
    .replace(/^["“](.*)["”]$/s, '$1')
    .trim()

  if (!text) {
    throw new Error('The model did not return any alt text')
  }

  return enforceLen(text, MAX_ALT_TEXT, true)
}
