import {LANGUAGES_MAP_CODE2} from '#/locale/languages'

/**
 * English name for a post language code, e.g. `pt` -> `Portuguese`. The
 * on-device model is instructed in English, so the target language is named in
 * English even when the app UI is in another language.
 */
export function languageEnglishName(code: string): string {
  // Some entries are alias lists, e.g. `Zaza; Dimili; Dimli`; the first is enough.
  const name = LANGUAGES_MAP_CODE2[code]?.name.split(';')[0]?.trim()
  return name || code
}

/**
 * Builds the instruction for the small on-device vision model. It mirrors the
 * rules of `DEFAULT_ALT_TEXT_AI_PROMPT` but is written as a short list, which
 * small models follow more reliably than prose, and names the output language
 * explicitly.
 */
export function buildLocalAltTextPrompt(languages: readonly string[]): string {
  const target = languages[0] ? languageEnglishName(languages[0]) : 'English'

  return [
    'Write alt text for this image for blind and low-vision readers.',
    '- Describe only what is clearly visible. Do not guess names, brands, or identities.',
    '- Be concise: one or two sentences for a simple image.',
    '- If the image contains readable text, transcribe it instead of describing it.',
    '- Do not start with "Image of" or "The image shows".',
    `- Write the alt text in ${target}.`,
    'Reply with the alt text only.',
  ].join('\n')
}
