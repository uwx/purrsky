import {useState} from 'react'

import {type NewPostsPillAuthor} from '#/components/NewPostsPill'
import {
  type FeedPostSlice,
  type FeedPostSliceItem,
  type StagedPage,
} from './queries/postFeed'
import {SETTLE_AT_TOP_LIMIT} from './useSettleAtTop'

/** How many faces the pill shows. */
const FACE_LIMIT = 3

/** The parts of a feed row that the pill reads. */
type Row = {
  type: string
  key: string
  slice?: FeedPostSlice
  items?: FeedPostSlice[] | FeedPostSliceItem[]
}

/** Post items represented by a row, one per post: a slice's own post. */
function rowPosts(row: Row): FeedPostSliceItem[] {
  if (row.type === 'sliceItem' && row.slice) {
    const slice = row.slice
    const item = slice.items.find(item => item.uri === slice.feedPostUri)
    return item ? [item] : []
  }
  if (row.type === 'reposts') {
    return ((row.items ?? []) as FeedPostSlice[]).flatMap(slice => {
      const item = slice.items.find(item => item.uri === slice.feedPostUri)
      return item ? [item] : []
    })
  }
  // A grid row has already flattened its page's posts into items.
  if (row.type === 'videoGridRow' || row.type === 'mediaGridRow') {
    return (row.items ?? []) as FeedPostSliceItem[]
  }
  return []
}

/** The parts of a rendered feed page that the pill reads. */
type Page = {
  fetchedAt: number
  slices: readonly FeedPostSlice[]
}

/**
 * What the pill offers: the posts on a page the view staged above where the
 * reader was (see `usePostFeedPrepend`), as they rendered when it was first
 * offered. It's a
 * snapshot, so its count stays as it was however the rows change, while its
 * faces only ever drop out (see {@link livePrependOffer}).
 */
export type PrependOffer = {
  /** The keys of the offered rows. */
  keys: string[]
  /**
   * How many posts are offered: one per feed item, as a reply's thread
   * context isn't a new post of its own.
   */
  count: number
  /**
   * Up to {@link FACE_LIMIT} of the posts' authors, distinct and newest
   * first, leaving out any whose avatar isn't safe to show.
   */
  authors: NewPostsPillAuthor[]
}

/**
 * The author of a feed item's own post, if their avatar is safe to show: they
 * have one, and moderation neither blurs nor filters it.
 */
function faceOf(item: FeedPostSliceItem): NewPostsPillAuthor | undefined {
  const {did, avatar} = item.post.author
  const ui = item.moderation.ui('avatar')
  if (!avatar || ui.blur || ui.filter) {
    return undefined
  }
  return {did, avatar}
}

/**
 * What a staged `page` offers, as the list renders it: the post rows from that
 * page, which are the rows above where the reader was. Rows the list leaves
 * out, such as muted authors', aren't offered. Neither are saved-feed samples,
 * as `page` is the page without them, nor the gap row below it. `undefined`
 * when none of its posts render.
 */
export function getPrependOffer(
  rows: readonly Row[],
  page: Page,
): PrependOffer | undefined {
  const uris = new Set(page.slices.map(slice => slice.feedPostUri))
  const counted = new Set<string>()
  const keys: string[] = []
  const authors: NewPostsPillAuthor[] = []
  for (const row of rows) {
    const posts = rowPosts(row).filter(item => uris.has(item.uri))
    if (!posts.length) continue
    keys.push(row.key)
    for (const item of posts) {
      if (counted.has(item.uri)) continue
      counted.add(item.uri)
      const face = faceOf(item)
      if (
        face &&
        authors.length < FACE_LIMIT &&
        !authors.some(author => author.did === face.did)
      ) {
        authors.push(face)
      }
    }
  }
  if (!counted.size) {
    return undefined
  }
  return {keys, count: counted.size, authors}
}

/**
 * The parts of `offer` that follow the rows as they are now: the topmost of
 * its rows that still renders, `undefined` once none do, and the faces whose
 * posts still render with an avatar that's safe to show, as a deletion, a mute
 * or a block can take a post away and a label can make an avatar unsafe.
 */
export function livePrependOffer(
  offer: PrependOffer,
  rows: readonly Row[],
): {topKey: string | undefined; authors: NewPostsPillAuthor[]} {
  const keys = new Set(offer.keys)
  const faces = new Set<string>()
  let topKey: string | undefined
  for (const row of rows) {
    if (!keys.has(row.key)) continue
    const posts = rowPosts(row)
    if (!posts.length) continue
    topKey ??= row.key
    for (const item of posts) {
      const face = faceOf(item)
      if (face) faces.add(face.did)
    }
  }
  return {
    topKey,
    authors: offer.authors.filter(author => faces.has(author.did)),
  }
}

/**
 * The new posts pill for the page a view's prepends staged above the reader
 * (see `usePostFeedPrepend`). Once that page is offered and its rows render,
 * it takes a snapshot of them as its offer (see {@link getPrependOffer}).
 *
 * The pill shows while the view is active, the page is staged and offered,
 * and some of its rows still render, which includes a view that prepended in
 * the background becoming active. A page another replaces keeps the offer, so
 * the pill stays, with the new page's posts. It hides once the reader reaches
 * the posts, which reads the page.
 *
 * Pressing it scrolls up to the top, without fetching. Already at the top,
 * where there's no scroll to report reaching it, `onRead` reads the page.
 */
export function usePrependPill({
  enabled,
  isActive,
  staged,
  rows,
  pages,
  offsetY,
  scrollToTop,
  onRead,
}: {
  /** Whether the view offers prepended posts at all. */
  enabled: boolean
  /** Whether the view is the one on screen. */
  isActive: boolean
  /** The page the view's prepends staged on top, if any. */
  staged: StagedPage | undefined
  /** The rows the list renders. */
  rows: readonly Row[]
  /** The feed's pages as they render, without saved-feed samples. */
  pages: readonly Page[] | undefined
  /** The list's scroll offset. */
  offsetY: {get(): number}
  /** Scrolls the list to its true top. */
  scrollToTop: () => void
  /** Reads the staged page. */
  onRead: () => void
}) {
  /** The offer of the last staged page offered, by its `fetchedAt`. */
  const [snapshot, setSnapshot] = useState<{
    fetchedAt: number
    offer: PrependOffer | undefined
  }>()

  const top = pages?.[0]
  const page = staged && top?.fetchedAt === staged.fetchedAt ? top : undefined
  // A page's rows render after it commits, which may be after it's offered.
  if (
    enabled &&
    page &&
    staged?.offered &&
    snapshot?.fetchedAt !== page.fetchedAt
  ) {
    setSnapshot({fetchedAt: page.fetchedAt, offer: getPrependOffer(rows, page)})
  }
  const offer =
    page && snapshot?.fetchedAt === page.fetchedAt ? snapshot.offer : undefined
  const live = offer && livePrependOffer(offer, rows)

  return {
    visible:
      enabled && isActive && !!staged?.offered && live?.topKey !== undefined,
    // The last offer's, so the pill keeps it as it hides.
    count: snapshot?.offer?.count ?? 0,
    authors: live?.authors ?? [],
    onPress: () => {
      if (offsetY.get() <= SETTLE_AT_TOP_LIMIT) {
        onRead()
      }
      scrollToTop()
    },
  }
}
