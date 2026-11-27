import {type AppBskyRichtextFacet} from '@atproto/api'
import {RichText, UnicodeString} from '@bsky/sdk/richtext'

import {
  applyFormattingFacets,
  featureOf,
  formattingIn,
  kindOf,
  piecesOf,
  shift,
  type Kind,
} from './formatting'

function facet(text: string, value: string, kind: Kind): AppBskyRichtextFacet.Main {
  const start = text.indexOf(value)
  const unicode = new UnicodeString(text)
  return {
    index: {
      byteStart: unicode.utf16IndexToUtf8Index(start),
      byteEnd: unicode.utf16IndexToUtf8Index(start + value.length),
    },
    features: [featureOf(kind)],
  }
}

describe('Parfait formatting syntax', () => {
  it.each(['2*3*4', '*nix', 'snake_case', '** spaced **', '*two\nlines*', '\\**literal**'])('leaves literal boundaries alone: %s', text => {
    expect(formattingIn(text).formats).toEqual([])
  })

  it('supports nested spans while rejecting crossing spans', () => {
    const text = '**bold *italic* and ~~struck~~**'
    expect(formattingIn(text).formats.map(format => [format.kind, text.slice(format.start, format.end)])).toEqual([
      ['bold', 'bold *italic* and ~~struck~~'],
      ['italic', 'italic'],
      ['strikethrough', 'struck'],
    ])
    expect(formattingIn('**bold *cross** outside*').formats.map(f => f.kind)).toEqual(['bold'])
  })

  it('leaves code and fences literal and suppresses their linked spans', () => {
    const text = '`**literal** example.com`\n```JS\n*literal* @person.test\n```'
    const linked = [{start: text.indexOf('example.com'), end: text.indexOf('example.com') + 11}]
    const result = formattingIn(text, linked)
    expect(result.formats.map(f => f.kind)).toEqual(['code'])
    expect(result.linked).toEqual([])
    expect(result.blocks[0].language).toBe('js')
    expect(result.blocks[0].code).toBe('*literal* @person.test')
    expect(result.escapes).toEqual([])
  })

  it('keeps links whole and suppresses links, mentions and tags in spoilers', () => {
    const text = '**example.com** || @person.test #tag example.org ||'
    const spans = ['example.com', '@person.test', '#tag', 'example.org'].map(value => ({start: text.indexOf(value), end: text.indexOf(value) + value.length}))
    expect(formattingIn(text, spans).linked).toEqual([spans[0]])
    expect(formattingIn(text, spans).formats.map(f => f.kind)).toEqual(['bold', 'spoiler'])
    expect(formattingIn('https://example.com/a_b_c', [{start: 0, end: 27}]).formats).toEqual([])
  })

  it('collects each escaped backslash once and never unescapes code', () => {
    const text = '\\*literal* \\\\ **bold** `\\*code*`'
    const result = formattingIn(text)
    expect(result.escapes).toEqual([0, text.indexOf('\\\\')])
    expect(result.formats.map(f => f.kind)).toEqual(['bold', 'code'])
  })
})

describe('formatting facets', () => {
  it('recognizes only exact supported namespace features', () => {
    expect(kindOf(featureOf('bold'))).toBe('bold')
    for (const $type of [
      'social.parfait.richtext.facet#unknown',
      'evil.social.parfait.richtext.facet#bold',
      'social.parfait.richtext.facet#bold.extra',
      'social.parfait.richtext.facet#underline',
      'social.parfait.richtext.facet#highlight',
      'blog.pckt.richtext.facet#spoiler',
      'blog.pckt.richtext.facet#bold.extra',
      'evil.blog.pckt.richtext.facet#bold',
      'blog.pckt.richtext.facet#id',
      'blog.pckt.richtext.facet#link',
      'blog.pckt.richtext.facet#didMention',
      'blog.pckt.richtext.facet#atMention',
      'blog.pckt.richtext.facet#footnote',
    ]) {
      expect(kindOf({$type})).toBeUndefined()
    }
    expect(kindOf(undefined)).toBeUndefined()
    expect(kindOf({$type: 123} as never)).toBeUndefined()
  })

  it('uses valid UTF-8 boundaries and segments overlapping features once', () => {
    const text = '🌟 **hé [世]**!'
    const bold = facet(text, 'hé [世]', 'bold')
    const link = facet(text, '世', 'italic')
    link.features = [{$type: 'app.bsky.richtext.facet#link', uri: 'https://example.com'}]
    const pieces = piecesOf(text, [bold, link])
    expect(pieces.map(piece => piece.text).join('')).toBe('🌟 hé [世]!')
    const linked = pieces.find(piece => piece.text === '世')!
    expect(linked.start).toBe(text.indexOf('世'))
    expect(linked.kinds).toEqual(['bold'])
    expect(linked.features).toEqual([...bold.features, ...link.features])
  })

  it('falls back literally for malformed byte ranges and unknown features', () => {
    const text = '🌟 **word**'
    const invalid = [
      {index: {byteStart: 1, byteEnd: 9}, features: [featureOf('bold')]},
      {index: {byteStart: -1, byteEnd: 10}, features: [featureOf('spoiler')]},
      {index: {byteStart: 7, byteEnd: 100}, features: [featureOf('code')]},
    ]
    expect(piecesOf(text, invalid).map(p => p.text).join('')).toBe(text)
    const unknown = facet(text, 'word', 'bold')
    unknown.features = [{$type: 'social.parfait.richtext.facet#unsupported'}]
    expect(piecesOf(text, [unknown]).map(p => p.text).join('')).toBe(text)
  })

  it('does not hide unmatched markers or require markers on foreign facets', () => {
    const text = '**word!'
    expect(piecesOf(text, [facet(text, 'word', 'bold')]).map(p => p.text).join('')).toBe(text)
    expect(piecesOf('word', [facet('word', 'word', 'bold')])).toMatchObject([{text: 'word', kinds: ['bold']}])
  })

  it('decodes each overlapping spoiler once and groups all of its pieces', () => {
    const text = '||uryyb 678|| ||jbeyq||'
    const first = facet(text, 'uryyb 678', 'spoiler')
    const second = facet(text, 'jbeyq', 'spoiler')
    const bold = facet(text, 'uryyb', 'bold')
    const pieces = piecesOf(text, [first, second, bold])
    expect(pieces.map(p => p.text).join('')).toBe('hello 123 world')
    expect(pieces.filter(p => p.spoiler === 0).map(p => p.text).join('')).toBe('hello 123')
    expect(pieces.filter(p => p.spoiler === 1).map(p => p.text).join('')).toBe('world')
    expect(shift(shift('Héllo 123 🌟'))).toBe('Héllo 123 🌟')
  })

  it('leaves previews untouched and posts spoilers and escapes only once', () => {
    const source = '🌟 \\*literal* ||hello 123 世||'
    const rt = new RichText({text: source})
    applyFormattingFacets(rt)
    applyFormattingFacets(rt)
    expect(rt.text).toBe(source)
    expect(rt.facets).toHaveLength(1)
    applyFormattingFacets(rt, {forPosting: true})
    const facets = rt.facets
    expect(rt.text).toBe('🌟 *literal* ||uryyb 678 世||')
    expect(piecesOf(rt.text, rt.facets).map(p => p.text).join('')).toBe('🌟 *literal* hello 123 世')
    applyFormattingFacets(rt, {forPosting: true})
    expect(rt.text).toBe('🌟 *literal* ||uryyb 678 世||')
    expect(rt.facets).toBe(facets)
  })
})

it('trims swallowed closing markers only when the opening marker precedes a linked span', () => {
  const text = '||@person.test #tag example.com||'
  const start = text.indexOf('example.com')
  const parsed = formattingIn(text, [{start, end: text.length}])
  expect(parsed.formats.map(format => format.kind)).toEqual(['spoiler'])
  expect(parsed.linked).toEqual([])

  const url = 'https://example.com/a**real**'
  const linked = [{start: 0, end: url.length}]
  expect(formattingIn(url, linked).linked).toEqual(linked)
  expect(formattingIn(url, linked).formats).toEqual([])
})

describe('blog.pckt formatting', () => {
  const blog = (kind: string) => ({$type: `blog.pckt.richtext.facet#${kind}`})

  it('recognizes all six markerless variants and emits only the two new blog types', () => {
    for (const kind of ['bold', 'italic', 'strikethrough', 'code', 'underline', 'highlight'] as const) {
      expect(kindOf(blog(kind))).toBe(kind)
      expect(featureOf(kind).$type).toBe(
        `${kind === 'underline' || kind === 'highlight' ? 'blog.pckt' : 'social.parfait'}.richtext.facet#${kind}`,
      )
    }
    expect(featureOf('spoiler').$type).toBe('social.parfait.richtext.facet#spoiler')
  })

  it('segments the exact live fixture without dropping its trailing underlined space', () => {
    const text = 'hello world '
    const facets = [
      {index: {byteStart: 0, byteEnd: 5}, features: [blog('bold'), blog('underline')]},
      {index: {byteStart: 5, byteEnd: 6}, features: [blog('underline')]},
      {index: {byteStart: 6, byteEnd: 11}, features: [blog('underline'), blog('italic'), blog('strikethrough'), blog('code')]},
      {index: {byteStart: 11, byteEnd: 12}, features: [blog('underline')]},
    ]
    expect(piecesOf(text, facets).map(({text: value, kinds}) => [value, kinds])).toEqual([
      ['hello', ['bold', 'underline']],
      [' ', ['underline']],
      ['world', ['underline', 'italic', 'strikethrough', 'code']],
      [' ', ['underline']],
    ])
  })

  it.each([
    ['**word**', 'bold'],
    ['*word*', 'italic'],
    ['_word_', 'italic'],
    ['~~word~~', 'strikethrough'],
    ['`word`', 'code'],
    ['__word__', 'underline'],
    ['==word==', 'highlight'],
  ])('never hides literal blog markers in %s', (text, kind) => {
    const span = facet(text, 'word', kind as Kind)
    span.features = [blog(kind)]
    const pieces = piecesOf(text, [span])
    expect(pieces.map(piece => piece.text).join('')).toBe(text)
    expect(pieces.find(piece => piece.text === 'word')?.kinds).toEqual([kind])
  })

  it('combines overlapping namespaces without merging their marker ownership', () => {
    const text = '**one** **two**'
    const first = facet(text, 'one', 'bold')
    const second = facet(text, 'two', 'bold')
    second.features = [blog('bold')]
    const overlap = {
      index: {byteStart: 2, byteEnd: text.length},
      features: [blog('italic'), blog('highlight')],
    }
    const pieces = piecesOf(text, [first, second, overlap])
    expect(pieces.map(piece => piece.text).join('')).toBe('one **two**')
    expect(pieces.find(piece => piece.text === 'one')?.kinds).toEqual(['bold', 'italic', 'highlight'])
    expect(pieces.find(piece => piece.text === 'two')?.kinds).toEqual(['bold', 'italic', 'highlight'])
  })

  it('parses nested new styles, whitespace-only runs and escaped equals', () => {
    const text = String.raw`__ hello ==世== __ == == \==literal==`
    const parsed = formattingIn(text)
    expect(parsed.formats.map(format => [format.kind, text.slice(format.start, format.end)])).toEqual([
      ['underline', ' hello ==世== '],
      ['highlight', '世'],
      ['highlight', ' '],
    ])
    expect(parsed.escapes).toEqual([text.indexOf('\\')])
  })

  it('removes only new delimiters and remaps Unicode facets exactly once', () => {
    const source = '🌟 __hé ==世== __ **old** \\=literal'
    const rt = new RichText({text: source})
    applyFormattingFacets(rt)
    expect(rt.text).toBe(source)
    applyFormattingFacets(rt, {forPosting: true})
    expect(rt.text).toBe('🌟 hé 世  **old** =literal')
    expect(rt.facets?.map(span => [span.index, span.features.map(kindOf)])).toEqual([
      [{byteStart: 5, byteEnd: 13}, ['underline']],
      [{byteStart: 9, byteEnd: 12}, ['highlight']],
      [{byteStart: 16, byteEnd: 19}, ['bold']],
    ])
    const facets = rt.facets
    applyFormattingFacets(rt, {forPosting: true})
    expect(rt.facets).toBe(facets)
    expect(rt.text).toBe('🌟 hé 世  **old** =literal')
  })
})
