import {
  type BluemojiPack,
  getBlobCid,
  getBlobRefs,
  getPackDescriptionError,
  getPackEmbedRoute,
  getPackNameError,
  groupItemsByPack,
  PACK_COLLECTION,
  PACK_DESCRIPTION_MAX_GRAPHEMES,
  PACK_NAME_MAX_BYTES,
  type PackMembership,
  parsePackUrl,
} from '#/features/bluemoji/packs/util'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {type blue} from '#/lexicons'

describe('pack URLs', () => {
  it('parses our own pack route with a handle or a DID', () => {
    expect(
      parsePackUrl('https://witchsky.app/profile/alice.test/emoji-pack/3abc'),
    ).toEqual({name: 'alice.test', rkey: '3abc'})
    expect(
      parsePackUrl(
        'https://witchsky.app/profile/did:plc:abc123/emoji-pack/3abc/',
      ),
    ).toEqual({name: 'did:plc:abc123', rkey: '3abc'})
  })

  it('parses moji.blue pack pages', () => {
    expect(parsePackUrl('https://moji.blue/packs/alice.test/3abc')).toEqual({
      name: 'alice.test',
      rkey: '3abc',
    })
  })

  it('ignores anything that is not a pack link', () => {
    expect(
      parsePackUrl('https://witchsky.app/profile/alice.test/theme/3abc'),
    ).toBeUndefined()
    expect(
      parsePackUrl('https://witchsky.app/profile/alice.test/emoji-pack/'),
    ).toBeUndefined()
    expect(parsePackUrl('https://moji.blue/packs/alice.test')).toBeUndefined()
    expect(parsePackUrl('javascript:alert(1)')).toBeUndefined()
    expect(
      parsePackUrl('https://witchsky.app/profile/alice/emoji-pack/3abc'),
    ).toBeUndefined()
  })

  it('prefers the pack record in associatedRefs over the URL', () => {
    const view = {
      uri: 'https://example.com/something-else',
      associatedRefs: [
        {uri: `at://did:plc:owner/${PACK_COLLECTION}/3def`},
        {uri: 'at://did:plc:owner/app.witchsky.theme.colors/3ghi'},
      ],
    }
    expect(getPackEmbedRoute(view)).toEqual({
      name: 'did:plc:owner',
      rkey: '3def',
    })
  })

  it('falls back to the URL when nothing is associated', () => {
    expect(
      getPackEmbedRoute({
        uri: 'https://witchsky.app/profile/alice.test/emoji-pack/3abc',
      }),
    ).toEqual({name: 'alice.test', rkey: '3abc'})
    expect(getPackEmbedRoute({uri: 'https://example.com/post'})).toBeUndefined()
  })
})

describe('field limits', () => {
  it('rejects empty and oversized pack names', () => {
    expect(getPackNameError('')).toBe('empty')
    expect(getPackNameError('   ')).toBe('empty')
    expect(getPackNameError('cats')).toBeUndefined()
    expect(getPackNameError('x'.repeat(PACK_NAME_MAX_BYTES))).toBeUndefined()
    expect(getPackNameError('x'.repeat(PACK_NAME_MAX_BYTES + 1))).toBe(
      'too_long',
    )
    // The lexicon caps bytes, not characters.
    expect(getPackNameError('é'.repeat(PACK_NAME_MAX_BYTES / 2 + 1))).toBe(
      'too_long',
    )
  })

  it('limits descriptions by graphemes', () => {
    expect(getPackDescriptionError('')).toBeUndefined()
    expect(
      getPackDescriptionError('a'.repeat(PACK_DESCRIPTION_MAX_GRAPHEMES)),
    ).toBeUndefined()
    expect(
      getPackDescriptionError('a'.repeat(PACK_DESCRIPTION_MAX_GRAPHEMES + 1)),
    ).toBe('too_long')
  })
})

describe('blob refs', () => {
  it('reads a CID from both blob link shapes', () => {
    expect(getBlobCid({ref: {$link: 'bafyabc'}})).toBe('bafyabc')
    expect(getBlobCid({ref: 'bafyabc'})).toBe('bafyabc')
    expect(getBlobCid(undefined)).toBeUndefined()
    expect(getBlobCid({ref: {$link: 'not a cid!'}})).toBeUndefined()
  })

  it('collects known rendition slots and ignores unknown ones', () => {
    const record = {
      $type: 'blue.moji.collection.item',
      name: ':cat:',
      createdAt: new Date().toISOString(),
      formats: {
        $type: 'blue.moji.collection.item#formats_v1',
        webp_128: {ref: {$link: 'bafywebp'}, mimeType: 'image/webp'},
        png_128: {ref: {$link: 'bafypng'}, mimeType: 'image/png'},
        unknown_slot: {ref: {$link: 'bafyunknown'}},
        empty: 'not a blob',
      },
    } as unknown as blue.moji.collection.item.Main
    expect(getBlobRefs(record)).toEqual([
      {slot: 'webp_128', cid: 'bafywebp', mimeType: 'image/webp'},
      {slot: 'png_128', cid: 'bafypng', mimeType: 'image/png'},
    ])
  })
})

describe('grouping the picker by pack', () => {
  function pack(uri: string, name: string) {
    return {uri, record: {name}} as BluemojiPack
  }

  function item(uri: string) {
    return {uri} as BluemojiItem
  }

  function membership(packUri: string, subject: string): PackMembership {
    return {
      uri: `at://did:plc:me/blue.moji.packs.packitem/${subject}`,
      subject,
      pack: packUri,
    }
  }

  it('files emoji under their pack, in pack order, with unpacks last', () => {
    const cats = pack('at://did:plc:me/blue.moji.packs.pack/cats', 'cats')
    const dogs = pack('at://did:plc:me/blue.moji.packs.pack/dogs', 'dogs')
    const a = item('at://did:plc:me/blue.moji.collection.item/a')
    const b = item('at://did:plc:me/blue.moji.collection.item/b')
    const loose = item('at://did:plc:me/blue.moji.collection.item/loose')

    const groups = groupItemsByPack(
      [loose, b, a],
      [cats, dogs],
      [membership(cats.uri, b.uri), membership(dogs.uri, a.uri)],
    )

    expect(groups.map(group => group.pack?.record.name)).toEqual([
      'cats',
      'dogs',
      undefined,
    ])
    expect(groups.map(group => group.items)).toEqual([[b], [a], [loose]])
  })

  it('shows an emoji that sits in several packs only once', () => {
    const first = pack('at://did:plc:me/blue.moji.packs.pack/first', 'first')
    const second = pack('at://did:plc:me/blue.moji.packs.pack/second', 'second')
    const shared = item('at://did:plc:me/blue.moji.collection.item/shared')

    const groups = groupItemsByPack(
      [shared],
      [first, second],
      [membership(second.uri, shared.uri), membership(first.uri, shared.uri)],
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].pack?.record.name).toBe('first')
    expect(groups[0].items).toEqual([shared])
  })

  it('drops packs that have no emoji in the collection', () => {
    const empty = pack('at://did:plc:me/blue.moji.packs.pack/empty', 'empty')
    const cats = pack('at://did:plc:me/blue.moji.packs.pack/cats', 'cats')
    const a = item('at://did:plc:me/blue.moji.collection.item/a')

    const groups = groupItemsByPack(
      [a],
      [empty, cats],
      [membership(cats.uri, a.uri)],
    )

    expect(groups.map(group => group.pack?.record.name)).toEqual(['cats'])
  })
})
