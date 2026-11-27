import {type ModerationOpts} from '@bsky/sdk/moderation'
import {RichText} from '@bsky/sdk/richtext'
import {CID} from 'multiformats/cid'

import {applyFacetSyntax} from '#/lib/strings/rich-text-manip'
import {
  animatedItem,
  imageCid,
  item,
  lottieCid,
} from '#/features/bluemoji/__tests__/fixtures'
import {
  createBluemojiFacet,
  detectBluemojiFacets,
  getBluemojiBlobUrl,
  getBluemojiFacet,
  getBluemojiImage,
  getBluemojiInsertionName,
  getBluemojiLottieCid,
  getBluemojiModeration,
  getBluemojiRefUri,
  isBluemojiRenderable,
  parseBluemojiItemRecord,
} from '#/features/bluemoji/util'
import {app, blue} from '#/lexicons'

jest.unmock('multiformats/cid')

it('writes v1 facets accepted by Bluemoji and Bluesky post schemas', () => {
  const facet = createBluemojiFacet(item)
  expect(blue.moji.richtext.facet.$matches(facet)).toBe(true)
  expect(facet.formats).toEqual({
    $type: 'blue.moji.richtext.facet#formats_v1',
    webp_128: imageCid,
  })
  expect(
    app.bsky.feed.post.$matches({
      $type: 'app.bsky.feed.post',
      text: item.record.name,
      createdAt: new Date().toISOString(),
      facets: [
        {
          index: {byteStart: 0, byteEnd: item.record.name.length},
          features: [facet],
        },
      ],
    }),
  ).toBe(true)
})

it('accepts the facet emitted by the Wafrn bridge', () => {
  const facet = {
    $type: 'blue.moji.richtext.facet',
    did: 'did:plc:vp5wiuodmvgxukajqf5egj3k',
    name: ':neocat_googly_shocked_256:',
    formats: {
      $type: 'blue.moji.richtext.facet#formats_v1',
      png_128: 'bafkreiat5bwxpkdjbarl5t6v44isxo7bmolry7ofptkf7fr6hfkf4i5uem',
    },
  }
  expect(getBluemojiFacet(facet)).toMatchObject(facet)
})

it('uses distinct fallback aliases for collisions and reuses prior selections', () => {
  const refs = {
    [item.record.name]: {
      did: item.did,
      name: item.record.name,
      record: {uri: item.uri, cid: item.cid},
    },
  }
  expect(getBluemojiInsertionName(item, refs)).toBe(item.record.name)
  const other = {...item, uri: `${item.uri}-other`}
  expect(getBluemojiInsertionName(other, refs)).toBe(':blobcat-2:')
  expect(
    getBluemojiInsertionName(other, {
      ...refs,
      ':blobcat-2:': refs[item.record.name],
    }),
  ).toBe(':blobcat-3:')
})

it('keeps UTF-8 offsets correct after Unicode text and resolves repeated aliases once', async () => {
  const rt = new RichText({text: '💙 café :blobcat: :blobcat:'})
  const lookup = jest.fn(() => Promise.resolve(item))
  await detectBluemojiFacets(rt, lookup)
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(
    rt.facets?.map(f =>
      rt.unicodeText.slice(f.index.byteStart, f.index.byteEnd),
    ),
  ).toEqual([':blobcat:', ':blobcat:'])
  expect(rt.facets?.[0].index.byteStart).toBe(11)
  expect([...rt.segments()].filter(segment => segment.facet)).toHaveLength(2)
})

it('does not resolve aliases inside links or replace existing facets', async () => {
  const rt = new RichText({text: 'https://example.com/:blobcat: :missing:'})
  rt.detectFacetsWithoutResolution()
  const original = rt.facets?.[0]
  const lookup = jest.fn(() => Promise.resolve(null))
  await detectBluemojiFacets(rt, lookup)
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(lookup).toHaveBeenCalledWith(':missing:')
  expect(rt.facets).toEqual([original])
})

it('derives Unicode references and rejects non-collection strong references', () => {
  expect(getBluemojiRefUri({did: item.did, name: ':日本語:'})).toBe(
    `at://${item.did}/blue.moji.collection.item/xn--wgv71a119e`,
  )
  expect(
    getBluemojiRefUri({
      did: item.did,
      name: item.record.name,
      record: {uri: `at://${item.did}/app.bsky.feed.post/abc`, cid: item.cid},
    }),
  ).toBeUndefined()
  expect(
    getBluemojiRefUri({did: 'https://example.com', name: ':cat:'}),
  ).toBeUndefined()
})

it('uses source assets, supports v0 blobs, and falls back for unsupported formats', () => {
  expect(getBluemojiImage(item)).toContain(imageCid)
  const formats = blue.moji.collection.item.formats_v1.$ifMatches(
    item.record.formats,
  )
  expect(
    getBluemojiImage({
      ...item,
      record: {
        ...item.record,
        formats: {
          $type: 'blue.moji.collection.item#formats_v0',
          webp_128: formats?.webp_128,
        },
      },
    }),
  ).toContain(imageCid)
  expect(
    getBluemojiImage({
      ...item,
      record: {
        ...item.record,
        formats: {$type: 'blue.moji.collection.item#formats_v0'},
      },
    }),
  ).toBeUndefined()
})

const opts = {
  userDid: item.did,
  prefs: {
    adultContentEnabled: true,
    labels: {porn: 'ignore', 'graphic-media': 'warn'},
  },
} as unknown as ModerationOpts

it('enforces source adultOnly and label preferences', () => {
  const adultItem = {...item, record: {...item.record, adultOnly: true}}
  expect(getBluemojiModeration(adultItem)).toBe('hide')
  expect(getBluemojiModeration(adultItem, opts)).toBe('ignore')
  expect(
    getBluemojiModeration(adultItem, {
      ...opts,
      prefs: {...opts.prefs, adultContentEnabled: false},
    }),
  ).toBe('hide')
  const warned = {
    ...item,
    record: {
      ...item.record,
      labels: {
        $type: 'com.atproto.label.defs#selfLabels' as const,
        values: [{val: 'graphic-media'}],
      },
    },
  }
  expect(getBluemojiModeration(warned, opts)).toBe('warn')
  expect(
    getBluemojiModeration(warned, {
      ...opts,
      prefs: {...opts.prefs, labels: {'graphic-media': 'hide'}},
    }),
  ).toBe('hide')
})

it('verifies legacy alias facets through their source record reference', () => {
  const legacy = {...item, uri: item.uri.replace('/blobcat', '/legacy-key')}
  const facet = createBluemojiFacet(legacy)
  expect(blue.moji.richtext.facet.$matches(facet)).toBe(true)
  expect(getBluemojiFacet(facet)?.record).toEqual({
    uri: legacy.uri,
    cid: legacy.cid,
  })
  expect(getBluemojiRefUri(getBluemojiFacet(facet)!)).toBe(legacy.uri)
})

it('removes odd escape markers without creating emoji facets and shifts valid UTF-8 ranges', async () => {
  const rt = new RichText({text: '💙 \\:blobcat: \\\\:blobcat: :blobcat:'})
  const lookup = jest.fn(() => Promise.resolve(item))
  await detectBluemojiFacets(rt, lookup)
  expect(rt.facets).toHaveLength(2)
  applyFacetSyntax(rt, {removeSyntax: true})
  expect(rt.text).toBe('💙 :blobcat: \\:blobcat: :blobcat:')
  expect(
    rt.facets?.map(f =>
      rt.unicodeText.slice(f.index.byteStart, f.index.byteEnd),
    ),
  ).toEqual([':blobcat:', ':blobcat:'])
  expect(rt.facets?.[0].index.byteStart).toBe(16)
})

it.each(['\\<:blobcat:>', '\\[:blobcat:](https://example.com)', '\\:blobcat:'])(
  'does not resolve protected emoji syntax %s',
  async text => {
    const rt = new RichText({text})
    const lookup = jest.fn(() => Promise.resolve(item))
    await detectBluemojiFacets(rt, lookup)
    applyFacetSyntax(rt, {removeSyntax: true})
    expect(lookup).not.toHaveBeenCalled()
    expect(rt.facets).toEqual([])
    expect(rt.text).toBe(text.slice(1))
  },
)

it('treats an animation as a rendition when the item has no picture', () => {
  expect(getBluemojiLottieCid(animatedItem)).toBe(lottieCid)
  expect(getBluemojiLottieCid(item)).toBeUndefined()
  expect(isBluemojiRenderable(animatedItem)).toBe(true)
  expect(isBluemojiRenderable(item)).toBe(true)
  expect(
    isBluemojiRenderable({
      ...animatedItem,
      record: {
        ...animatedItem.record,
        formats: {$type: 'blue.moji.collection.item#formats_v1'},
      },
    }),
  ).toBe(false)
  /* The CDN has no raster for it, so callers must not expect a picture URL. */
  expect(getBluemojiImage(animatedItem)).toBeUndefined()
  expect(createBluemojiFacet(animatedItem).formats).toEqual({
    $type: 'blue.moji.richtext.facet#formats_v1',
    lottie: lottieCid,
  })
})

it('keeps the licence that permits copying, and rejects one past the limit', () => {
  /*
   * The licence is the only thing the copy flow reads to decide whether
   * someone else may take a copy, so a record carrying one must survive the
   * strict parser. Past 128 bytes the lexicon drops the whole record, which is
   * why the editor caps the field.
   */
  expect(
    parseBluemojiItemRecord({...item.record, license: 'CC-BY-4.0'})?.license,
  ).toBe('CC-BY-4.0')
  expect(
    parseBluemojiItemRecord({...item.record, license: 'x'.repeat(129)}),
  ).toBeUndefined()
})

it('addresses blobs on the PDS that stores them', () => {
  expect(
    getBluemojiBlobUrl(animatedItem.did, lottieCid, 'https://pds.example'),
  ).toBe(
    `https://pds.example/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(animatedItem.did)}&cid=${lottieCid}`,
  )
  /* A trailing slash on the PDS must not double up in the path. */
  expect(
    getBluemojiBlobUrl(animatedItem.did, lottieCid, 'https://pds.example/'),
  ).toBe(
    `https://pds.example/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(animatedItem.did)}&cid=${lottieCid}`,
  )
})

it('reads an item whose original slot is the animated document itself', () => {
  /*
   * moji.blue's own client writes the raw Lottie JSON to `original` as
   * `application/json`, which formats_v1.original does not accept, so strict
   * validation drops the whole record. The lottie slot is what we draw.
   */
  const raw = {
    $type: 'blue.moji.collection.item',
    name: ':telemoji_1f51e:',
    createdAt: '2026-11-17T10:18:55.065Z',
    formats: {
      $type: 'blue.moji.collection.item#formats_v1',
      lottie: {
        $type: 'blob',
        ref: CID.parse(lottieCid),
        size: 51553,
        mimeType: 'application/json',
      },
      original: {
        $type: 'blob',
        ref: CID.parse(lottieCid),
        size: 51553,
        mimeType: 'application/json',
      },
    },
  }
  expect(blue.moji.collection.item.$ifMatches(raw)).toBeUndefined()
  const record = parseBluemojiItemRecord(raw)
  expect(record?.name).toBe(':telemoji_1f51e:')
  expect(record && getBluemojiLottieCid({...animatedItem, record})).toBe(
    lottieCid,
  )
  /* A record the lexicon accepts is returned untouched, `original` included. */
  expect(parseBluemojiItemRecord(animatedItem.record)).toEqual(
    blue.moji.collection.item.$ifMatches(animatedItem.record),
  )
})
