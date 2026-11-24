import {MAX_ALT_TEXT} from '#/lib/constants'
import {buildLocalAltTextPrompt, languageEnglishName} from './prompt'
import {finalizeLocalAltText} from './shared'

describe('languageEnglishName', () => {
  it('uses the English name of a post language', () => {
    expect(languageEnglishName('pt')).toBe('Portuguese')
    expect(languageEnglishName('ja')).toBe('Japanese')
  })

  it('keeps only the first name of an alias list', () => {
    expect(languageEnglishName('ki')).toBe('Kikuyu')
  })

  it('falls back to the code when the language is unknown', () => {
    expect(languageEnglishName('xx')).toBe('xx')
  })
})

describe('buildLocalAltTextPrompt', () => {
  it('asks for the alt text in the first post language', () => {
    const prompt = buildLocalAltTextPrompt(['de', 'en'])
    expect(prompt).toContain('- Write the alt text in German.')
    expect(prompt.endsWith('Reply with the alt text only.')).toBe(true)
  })

  it('defaults to English without a post language', () => {
    expect(buildLocalAltTextPrompt([])).toContain(
      '- Write the alt text in English.',
    )
    expect(buildLocalAltTextPrompt(['xx'])).toContain(
      '- Write the alt text in xx.',
    )
  })
})

describe('finalizeLocalAltText', () => {
  it('strips a leading label', () => {
    expect(finalizeLocalAltText('Alt text: A red bicycle.')).toBe(
      'A red bicycle.',
    )
    expect(finalizeLocalAltText('Image description: A red bicycle.')).toBe(
      'A red bicycle.',
    )
  })

  it('strips wrapping quotes', () => {
    expect(finalizeLocalAltText('“A red bicycle.”')).toBe('A red bicycle.')
    expect(finalizeLocalAltText('"A red bicycle."')).toBe('A red bicycle.')
  })

  it('drops reasoning produced by the model', () => {
    expect(finalizeLocalAltText('<think>Hmm.</think>\nA red bicycle.')).toBe(
      'A red bicycle.',
    )
  })

  it('truncates to the alt text limit', () => {
    const result = finalizeLocalAltText('a'.repeat(MAX_ALT_TEXT + 10))
    expect(result).toHaveLength(MAX_ALT_TEXT + 1)
    expect(result.endsWith('…')).toBe(true)
  })

  it('rejects an empty reply', () => {
    expect(() => finalizeLocalAltText('   ')).toThrow(
      'The model did not return any alt text',
    )
  })
})
