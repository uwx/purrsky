import {quotesBlockedAccount} from '#/lib/quotesBlockedAccount'
import {
  type FeedPostSlice,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {embedViewRecordToPostView, getEmbeddedPost} from '#/state/queries/util'
import {getSeenAt} from '#/state/seen-posts'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

function collectPdsProfileDids(
  post: app.bsky.feed.defs.PostView,
  dids = new Set<string>(),
  depth = 0,
) {
  dids.add(post.author.did)

  /* Bound recursion while covering nested quotes in normal posts. */
  if (depth < 4) {
    const embeddedPost = getEmbeddedPost(post.embed)
    if (embeddedPost) {
      collectPdsProfileDids(
        embedViewRecordToPostView(embeddedPost),
        dids,
        depth + 1,
      )
    }
  }

  return dids
}

/** Authors in a rendered row, including nested quotes, for PDS fetch priority. */
export function collectPdsProfileDidsForFeedRow(item: {
  type: string
  slice?: FeedPostSlice
  indexInSlice?: number
  items?: FeedPostSlice[] | FeedPostSliceItem[]
}) {
  const dids = new Set<string>()
  if (item.type === 'sliceItem' && item.slice) {
    collectPdsProfileDids(item.slice.items[item.indexInSlice ?? 0].post, dids)
  } else if (item.type === 'reposts') {
    for (const slice of (item.items ?? []) as FeedPostSlice[]) {
      for (const sliceItem of slice.items) {
        collectPdsProfileDids(sliceItem.post, dids)
      }
    }
  } else if (item.type === 'videoGridRow' || item.type === 'mediaGridRow') {
    for (const sliceItem of (item.items ?? []) as FeedPostSliceItem[]) {
      collectPdsProfileDids(sliceItem.post, dids)
    }
  }
  return dids
}

/**
 * Post URIs in a rendered row, for automatic translation. Deliberately stops at
 * the row's own posts: quoted posts are not what the row is showing.
 */
export function collectPostUrisForFeedRow(item: {
  type: string
  slice?: FeedPostSlice
  indexInSlice?: number
  items?: FeedPostSlice[] | FeedPostSliceItem[]
}) {
  const uris: string[] = []
  if (item.type === 'sliceItem' && item.slice) {
    uris.push(item.slice.items[item.indexInSlice ?? 0].post.uri)
  } else if (item.type === 'reposts') {
    for (const slice of (item.items ?? []) as FeedPostSlice[]) {
      for (const sliceItem of slice.items) {
        uris.push(sliceItem.post.uri)
      }
    }
  } else if (item.type === 'videoGridRow' || item.type === 'mediaGridRow') {
    for (const sliceItem of (item.items ?? []) as FeedPostSliceItem[]) {
      uris.push(sliceItem.post.uri)
    }
  }
  return uris
}

/**
 * A masonry block of the media grid. Same shape as a video grid row, since
 * both are a run of posts flattened into tiles.
 */
export type MediaGridFeedRow = {
  type: 'mediaGridRow'
  key: string
  items: FeedPostSliceItem[]
  sourceFeedUri: string
  feedContexts: (string | undefined)[]
  reqIds: (string | undefined)[]
}

type PostRowsSource = {
  type: string
  key: string
  slice?: FeedPostSlice
  indexInSlice?: number
  items?: FeedPostSlice[] | FeedPostSliceItem[]
  feedContexts?: (string | undefined)[]
  reqIds?: (string | undefined)[]
}

/**
 * Row types the media grid keeps. Everything else is editorial furniture -
 * interstitials, the feed description, the show-less followup - which would
 * break up a view that is meant to be nothing but media. Errors, the end of
 * the feed and the pagination gap stay, since they are functional.
 */
export const MEDIA_GRID_ROW_TYPES: ReadonlySet<string> = new Set([
  'error',
  'empty',
  'loadMoreError',
  'refreshError',
  'feedShutdownMsg',
  'loading',
  'mediaGridRowPlaceholder',
  'gap',
  'ageAssuranceBanner',
])

/**
 * Collapses runs of post rows into media grid rows of at most `maxPosts`
 * posts, dropping posts without media. Every other row - interstitials,
 * errors, the loading placeholder - stays where it was, which is what splits
 * the grid into blocks.
 *
 * With `keepRowTypes`, only rows of those types survive. The grid view drops
 * everything else, so an interstitial or a feed description cannot take over
 * a page that is meant to be only media.
 */
export function groupRowsForMediaGrid<T extends PostRowsSource>(
  rows: T[],
  {
    maxPosts,
    sourceFeedUri,
    hasMedia,
    keepRowTypes,
  }: {
    maxPosts: number
    sourceFeedUri: string
    hasMedia: (post: app.bsky.feed.defs.PostView) => boolean
    keepRowTypes?: ReadonlySet<string>
  },
): (T | MediaGridFeedRow)[] {
  const out: (T | MediaGridFeedRow)[] = []
  let buffer: Pick<
    MediaGridFeedRow,
    'items' | 'feedContexts' | 'reqIds'
  > | null = null

  const add = (
    item: FeedPostSliceItem | undefined,
    feedContext: string | undefined,
    reqId: string | undefined,
  ) => {
    if (!item || !hasMedia(item.post)) return
    buffer ??= {items: [], feedContexts: [], reqIds: []}
    buffer.items.push(item)
    buffer.feedContexts.push(feedContext)
    buffer.reqIds.push(reqId)
  }
  const flush = () => {
    if (!buffer) return
    out.push({
      type: 'mediaGridRow',
      key: `mediaGridRow-${buffer.items[0]._reactKey}`,
      items: buffer.items,
      sourceFeedUri,
      feedContexts: buffer.feedContexts,
      reqIds: buffer.reqIds,
    })
    buffer = null
  }
  const addAndMaybeFlush = (
    item: FeedPostSliceItem | undefined,
    feedContext: string | undefined,
    reqId: string | undefined,
  ) => {
    add(item, feedContext, reqId)
    if (buffer && buffer.items.length >= maxPosts) flush()
  }

  for (const row of rows) {
    if (row.type === 'sliceItem' && row.slice) {
      const slice = row.slice
      addAndMaybeFlush(
        slice.items[row.indexInSlice ?? 0],
        slice.feedContext,
        slice.reqId,
      )
    } else if (row.type === 'reposts') {
      for (const slice of (row.items ?? []) as FeedPostSlice[]) {
        addAndMaybeFlush(slice.items[0], slice.feedContext, slice.reqId)
      }
    } else if (row.type === 'videoGridRow') {
      const items = (row.items ?? []) as FeedPostSliceItem[]
      for (let i = 0; i < items.length; i++) {
        addAndMaybeFlush(items[i], row.feedContexts?.[i], row.reqIds?.[i])
      }
    } else {
      flush()
      if (!keepRowTypes || keepRowTypes.has(row.type)) {
        out.push(row)
      }
    }
  }
  flush()
  return out
}

export type FeedPostSliceOrGroup =
  | (FeedPostSlice & {
      isRepostSlice?: false
    })
  | {
      isRepostSlice: true
      slices: FeedPostSlice[]
    }

/**
 * Group dense runs of reposts without changing the order of ordinary posts.
 * Based on https://github.com/cheeaun/phanpy/blob/d608ee0a7594e3c83cdb087e81002f176d0d7008/src/utils/timeline-utils.js#L9
 */
export function groupReposts(values: FeedPostSlice[]) {
  let newValues: FeedPostSliceOrGroup[] = []
  const reposts: FeedPostSlice[] = []

  let serialReposts = 0

  for (const row of values) {
    if (bsky.isType(app.bsky.feed.defs.reasonRepost, row.reason)) {
      reposts.push(row)
      serialReposts++
      continue
    }

    newValues.push(row)
    if (serialReposts < 3) {
      serialReposts = 0
    }
  }

  // TODO: handle counts for multi-item slices
  if (
    values.length > 10 &&
    (reposts.length > values.length / 4 || serialReposts >= 3)
  ) {
    if (reposts.length > (values.length * 3) / 4) {
      newValues = [...newValues, {isRepostSlice: true, slices: reposts}]
    } else {
      const half = Math.floor(newValues.length / 2)
      newValues = [
        ...newValues.slice(0, half),
        {isRepostSlice: true, slices: reposts},
        ...newValues.slice(half),
      ]
    }

    return newValues
  }

  return values as FeedPostSliceOrGroup[]
}

/**
 * Drop posts last seen before the page was fetched. This runs in the feed
 * queries, before pagination counts items, so filtered pages keep fetching.
 */
export function filterSeenSlices(
  slices: FeedPostSlice[],
  fetchedAt: number | undefined,
) {
  if (fetchedAt === undefined) return slices
  return slices.filter(
    slice => (getSeenAt(slice.feedPostUri) ?? Infinity) >= fetchedAt,
  )
}

/** Filter before grouping, so a carousel cannot bypass feed preferences. */
export function filterFeedSlices(
  slices: FeedPostSlice[],
  {
    hideUnreplyablePosts,
    hideQuotesOfBlockedAccounts,
    blockedOrMutedAuthors,
  }: {
    hideUnreplyablePosts: boolean
    hideQuotesOfBlockedAccounts: boolean
    blockedOrMutedAuthors: string[]
  },
) {
  return slices.filter(
    slice =>
      !slice.items.some(
        item =>
          (hideUnreplyablePosts && item.post.viewer?.replyDisabled === true) ||
          (hideQuotesOfBlockedAccounts &&
            quotesBlockedAccount(item.post.embed)) ||
          blockedOrMutedAuthors.includes(item.post.author.did),
      ),
  )
}
