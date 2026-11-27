# Bluemoji

Witchsky displays inline `blue.moji.richtext.facet` emoji, provides a picker for
the composing account's collection and public discovery, supports
`blue.moji.feed.reaction` reactions, and can create, share and copy
`blue.moji.packs` packs. Sticker attachments are not supported. Selected emoji
retain their source owner in drafts, including when two collections use the same
alias.

## Trust boundary

Everything inside someone else's record is self-attested: a facet's `did`,
`name`, `formats`, `alt`, `adultOnly` and labels are whatever the poster's client
wrote, and nothing validates them. So:

- inline emoji normally render only after `fetchBluemojiItem` reads the
  `blue.moji.collection.item` back from its owner's PDS, and images and labels
  come from that record, never from the facet;
- Wafrn bridge accounts are an exception: they upload the image to the bridged
  account and put its CID in the post facet without creating a collection item.
  Colon-wrapped aliases in these posts render as unverified post media. The
  source emoji's labels and identity cannot be verified; facet claims of labels
  or adult content are left as text. This has the same trust boundary as an
  ordinary image attached to the post;
- picker search results are claims too, and only become tappable once the owning
  PDS confirms them;
- reaction `emojiRef`s from moji.blue's AppView are already rebuilt from the
  indexed source item. The Constellation fallback has no AppView, so it
  re-verifies every claimed item against its owner's PDS and drops the ones that
  do not resolve.

## Reactions

`src/features/bluemoji/reactions/` holds the whole feature:

- `queries.ts`: counts, per-post groups, the viewer's own reactions, and
  trending. Counts are asked for per post but fetched in bulk; lookups opened in
  the same tick coalesce into one `getReactionCounts` call, since a feed renders
  many posts at once.
- `constellation.ts`: the fallback for posts the AppView has nothing for. It is
  expensive (one `getRecord` per reactor), so it only runs once the AppView has
  answered with an empty list for a post that is actually on screen.
- `mutations.ts`: ordinary `createRecord`/`deleteRecord` against the user's own
  PDS, mirroring the TOKIMEKI poll vote. `validate: false` because our PDS does
  not know the lexicon.
- `ReactionStrip.tsx`: the row under a post. `ReactionDialog.tsx`: the sheet both
  the strip and the `PostControls` button open.

The AppView only fills in `group.viewer` for a request authenticated as that
actor, and our sessions live with our own OAuth client, so the viewer's own
reactions are read once per account with a `listRecords` walk of their repo
(reaction rkeys are TIDs and cannot be derived). Shortcut: the walk caps at 500
records; past that, the upgrade is an AppView query that takes a DID list.

Because `group.viewer` is always absent for us, a count can never be attributed
to a specific reactor. The viewer's records are merged in only to raise a group
they reacted with, and counts are never lowered locally: the AppView applies
reaction deletes, so `useInvalidateReactions` re-reads the truth instead. An
earlier version subtracted one from every count-1 group missing from the
viewer's list, which hid every other person's lone reaction from signed-in
users while logged-out rendering looked fine.

## Packs

`src/features/bluemoji/packs/` implements the upstream
`blue.moji.packs.pack`/`packitem` records (RFC 0002):

- `queries.ts`: every read goes straight to the owner's PDS. Packs have no
  AppView index we can rely on, so there is no count in `ProfileView` to gate a
  tab on and no paginated endpoint to page; `listRecords` is capped at 1000
  records so a pathological repo cannot stall a screen. Membership records carry
  a `pack` AT-URI that is filtered client-side, then each `subject` is resolved
  through the same verified `fetchBluemojiItem` path as inline emoji.
- `mutations.ts`: create/edit/delete packs, set their members, and copy a pack
  into the viewer's collection. Blobs cannot be referenced across repos, so a
  copy downloads each rendition from the source PDS and uploads it again, scoped
  by `copyOf`. Only emoji whose own `license` permits it are copied: an absent
  licence, `LicenseRef-…`, and unknown identifiers all read as "no permission",
  `OR` needs one usable operand, `AND` needs all of them. A copy whose alias is
  already in the collection is skipped, comparing aliases through
  `normalizeAlias` so another client's unnormalised `:name:` still dedupes, and
  re-adding an existing subject is skipped too.
- `PackEmbed.tsx`: renders a pack link as a card. The card reads the pack from
  its owner's PDS, so the icon, name and description shown are the record's, not
  the OG preview's. The route comes from `associatedRefs` when our composer wrote
  it, and otherwise from the URL, the same fallback themes use because the
  AppView strips unknown fields off `external`.
- `PacksSection.tsx` on the Custom emoji screen is where packs are created;
  `ProfilePacks.tsx` is the profile tab, with a footer link back to that screen
  for the viewer's own profile. The tab exists for every signed-in viewer
  because there is no count to gate it on, and it reads the repo only when
  focused.

The copy gate reads `blue.moji.collection.item.license`, not the pack's, so the
licence has to be on the emoji. `collection/mutations.ts` writes it from both
editors: the single form has a licence field, and a bulk upload applies one
licence to the whole batch. Each field says whether what was typed actually
permits copying, using the same `isCopyableLicense` the copy flow uses, because
an unrecognised expression is indistinguishable from no permission once written.
An edit that omits the field keeps the stored licence; an empty one clears it.

`functions/profile/[name]/emoji-pack/[rkey].ts` supplies the Open Graph tags
non-Witchsky clients see for a pack link. Provenance fields (`source`,
`license`) are self-asserted: `src/features/bluemoji/provenance.ts` only links
`http(s)` sources without credentials and canonical SPDX identifiers, and
renders everything else as text.

The web composer extends TipTap 2's Emoji node and renders verified aliases as
inline images. Shortcode autocomplete uses the upstream shared Autocomplete/Sift
menu and emoji search, combining local Unicode matches with verified results
from the composing account's collection. Unicode matches appear while custom
emoji load; arrows, Enter, and Tab select a result, and Escape dismisses the list. Selected sources are saved just like picker
selections. TipTap's default input and paste rules are disabled so the shared
escape-aware conversion handles typing, pasting, and commands consistently.
Arrow keys cross
each image in one step, and deletion removes the whole emoji. Editing, copying,
drafts, character counts, and posting retain the original alias text. Backslashes
follow the same escape rules as other facet syntax: an odd number of backslashes
before an alias disables its facet; escaped Markdown and angle brackets also
protect aliases inside them. Source resolution happens before removing escapes
so posting cannot re-enable an escaped emoji.

The native composer keeps source aliases in React state and projects verified
emoji into single full-width input slots. The native input draws text, the cursor,
and selection. A zero-size native observer anchors sibling image views to the
input's current character positions without laying out the composer or its
children. React Native controls the container, input size, and multiline growth.
Android updates before drawing; iOS uses
UIKit's character rectangles. Native edit ranges move and remove anchors without
waiting for JavaScript, and stale JS snapshots cannot rewind those positions.
No hidden text or asynchronous JS measurement layers are needed. Source verification,
escaping, drafts, and posting remain shared with the web composer.

Images and descriptions come from the owning PDS's verified collection record,
never from unverified facet claims or search results. Asset URLs use the verified
blob CID through moji.blue. Source alt text labels the image; empty descriptions
fall back to the emoji name. Clicking an emoji opens a compact popup showing its
name and source description. Native details use a bottom sheet and are enabled
only on the focused post; feed and reply-row emoji remain ordinary inline images. Hidden, warned, missing, or unsupported emoji remain
readable as aliases. Animation follows the autoplay preference.

Animated emoji often carry only a `lottie` rendition - the record has no raster
slot at all - so `BluemojiLottie` draws the document itself. moji.blue's CDN
indexes pictures and returns nothing for these blobs, so the player reads them
from the owning PDS through `com.atproto.sync.getBlob`, the same DID-document
lookup used for the PDS image fallback. Because that endpoint sends no cache
headers, fetched documents are cached in memory per URL (bounded, and evicted on
failure so a retry can succeed), and each mount parses its own copy since
lottie-web mutates the animation data it is given.

Web uses `lottie-web`'s light canvas player, lazily imported so it is not in the
initial bundle; canvas rather than SVG keeps hundreds of inline emoji cheap.
Native uses `lottie-react-native`. Playback starts after the first frame is
ready and follows the autoplay preference; a document that fails to load falls
back to the alias, as does one whose owning PDS cannot be resolved.

Some records cannot pass strict lexicon validation at all: moji.blue's own
client writes the Lottie document to `formats.original` as
`application/json`, which `formats_v1.original` does not accept, and one bad
blob rejects the whole record. `parseBluemojiItemRecord` retries without that
provenance slot, which is never drawn, and every read path uses it.

Canonical references derive record keys using NFC normalization and RFC 0005
punycode. Historical collections with unrelated record keys carry an optional
strong reference extension on the facet. Posting writes CID-based v1 formats;
reading supports v0 and v1. The collection fallback schema permits one grapheme
rather than one byte, since actual fallback emoji contain multibyte characters.

Inline images match the surrounding emoji font metrics on web. Native posts use
a measured Unicode emoji advance and descender to size and align image attachments,
including both the app's font scale and the system's accessibility font scale.
Short emoji-only
posts enlarge both Unicode emoji and Bluemoji using the existing post sizing rule.
The feature schemas cover collection items, listing, search, and rich-text facets.
