# Profile decorations

Avatar frames, avatar shapes, and display-name paints. Adapted from
[eurosky-social](https://github.com/eurosky-social/eurosky-social-app) and
[tenna.party](https://tangled.org/kris.kralsei.stream/tenna.party), which share
the `social.mu.deco.settings` record format, so an account decorated in either
app renders here unchanged.

## What gates rendering

A DID renders decorations when it has a `social.mu.deco.settings/self` record
in its own PDS:

```ts
{
  avatar?: frameId
  avatarShape?: shape
  name?: gradientId // curated preset
  nameOutline?: boolean
  avatarAnimated?: blob // GIF, WebP, APNG, or AVIF, played instead of the picture
  avatarColor?: string // #rrggbb, overrides the frame color
  nameColor?: string // #rrggbb, arbitrary solid name fill
  nameGradient?: {colors: string[]; hard?: boolean} // 2-3 #rrggbb stops
  nameFont?: string // Google Fonts family
  profileTheme?: {uri: string; colorSet?: string} // app.witchsky.theme.colors pointer
}
```

Every added slot is optional and additive, so an older client keeps rendering
`avatar`/`avatarShape`/`name`/`nameOutline` and ignores the rest. Parsing is
strict (`records.ts`): malformed colors, stop counts outside 2-3, and font
families outside the shipped catalog are dropped rather than rendered.

The record is read through Slingshot because the AppView only serves
`getRecord` for `app.bsky.*` collections. Unknown ids are ignored, so a record
written by a newer build can never render something this one lacks.

Any account can set decorations by writing that record; no list membership or
allowlist is checked. Since the record is public and self-authored, decorations
are purely cosmetic and must never carry trust.

## One query per DID

`useDecorations.ts` resolves a DID's record once per 30 minutes. The slot hooks
(`useAvatarDecoration`, `useAvatarShape`, `useNameGradient`, `useNameStyle`) all
read that one cache entry, so a feed of the same author does not fan out into
extra requests.

## Rendering

- **Frame** - `AvatarDecorationRing`, an absolute inset ring inside the avatar
  bounds, like the live-status border, so it never overflows the container.
  `resolveFrame` applies `avatarColor` over the curated frame's own color, and
  synthesizes a ring when a record names a color but no preset.
- **Shape** - `circle`, `square`, `squircle`, or `hexagon`. A hexagon cannot be
  a rounded rect, so `HexagonAvatar` clips the image with an SVG `ClipPath` and
  draws the border, frame, and live ring on the same path. This needs no native
  masked-view module, so it works on web and native alike. The clip id is
  unique per mounted instance: browsers resolve `url(#id)` to the first match in
  document order, so a shared id can resolve into an inactive screen kept
  mounted with `display: none`, which leaves the image unclipped.
- **Animated picture** - `avatarAnimated` holds an uploaded blob, so the bytes
  live in the owner's PDS and no third party has to be trusted with them. The
  image CDN re-encodes every rendition and drops the animation, so playback
  reads the blob straight from the owner's PDS
  (`com.atproto.sync.getBlob`), resolved from their DID document on demand.
  `UserAvatar` renders it with `expo-image`, which decodes animated GIF, WebP,
  and APNG on both platforms. The still slot points at the same blob through
  the CDN with `@png` - the first frame, with transparency intact - and is what
  a reduced-motion viewer, a hexagon avatar, or a failed playback request gets.
  A blob is only rendered when its mime type is one of GIF, WebP, APNG, or
  AVIF and its size is under 4 MB, so a record cannot make a viewer fetch
  arbitrary bytes.
- **Name paint** - `namePaint.ts` resolves one record slot into
  `{gradient?, color?, outline, font?}`. Precedence is custom gradient, custom
  solid, then the curated `name` preset; `useNameStyle` turns the result into a
  text style so every call site stays unaware of which paint is in play.
- **Gradient** - web paints a real `background-clip: text` gradient. Stops are
  sampled in OKLCH first (`oklch.ts`) and handed to the browser as hex, because
  browsers interpolate hex stops in sRGB and would bend the ramp (`in oklch` is
  still too new to depend on). Native cannot take a paint gradient, so
  `GradientNameText` colors each grapheme using the same sampling; font metrics
  are unchanged, so wrapping and `numberOfLines` truncation behave as before,
  and emoji keep their own colors.
- **Outline** - `outlineColorFor` picks the edge color that maximizes the
  minimum WCAG contrast across the gradient stops: near-black by default, white
  when the fill is dark enough to swallow a dark edge. Web draws it with four
  axis-aligned `drop-shadow`s, native with a tight `textShadow`.
- **Fonts** - no font file is bundled. `googleFonts.ts` is a generated catalog
  of ~1800 latin families, and `nameFonts.ts` fetches a face the first time a
  name actually renders with it: a `<link>`-injected css2 response on web
  (woff2, split by `unicode-range`), a legacy-UA TTF registered through
  `expo-font` on native. Faces load under an `nf_` alias so a device-installed
  family of the same name can never shadow it. The picker uses a separate
  `nf_<family>__preview` alias with `text=` subsetting, because `expo-font`
  ignores a later load of an already-loaded family.

A blurred avatar and a blurred display name never render decorations, since the
decoration would reveal the moderated content's shape or name color.

## Profile theme

`profileTheme` points at a published `app.witchsky.theme.colors` record the
owner picked for their profile (`screens/Theme.tsx`, "Set as profile theme").
Only the pointer is stored, so editing the theme changes the profile without
rewriting decorations. `features/themes/profileTheme.tsx` resolves it and wraps
the profile screen in an alf context override, so the header, tabs, and canvas
use the author's colors while the rest of the app keeps the viewer's theme.

The pointer is validated as a three-part AT URI at a `?`/`#`-free path and must
name the theme collection; the record itself still has to pass
`isSupportedTheme`. A pointer at a deleted or unknown record simply paints
nothing. A blurred (moderated) profile is never painted, since the theme would
reveal the decoration before the content.

## Viewer preferences

Two viewer-side display options (`state/preferences`) sit on top of the record:

- `showNameOutlines` - adds an outline to decorated names (gradient or custom
  color) whose owner did not enable one. Plain theme-colored names are left
  alone: they already contrast with the page, and a fixed-color halo would hurt
  one of the two themes.
- `disableCustomNameStyles` - ignores `nameColor`, `nameGradient`, and
  `nameFont` from other accounts. Curated presets and avatar frame/shape keep
  rendering.
- `disableProfileThemes` - keeps `profileTheme` from painting the profile page,
  so every profile uses the viewer's own theme. Appearance settings has the
  toggle ("Ignore profile themes").

## Editing

The editor lives in the feature (`editor/DecorationsEditor.tsx`) and is rendered
inline in the edit-profile dialog (`screens/Profile/Header/EditProfileDialog.tsx`),
so decorations save with the rest of the profile. It owns no record state: the
dialog keeps the draft and writes it before the profile record. There is no
separate decorations screen: Settings -> Profile decorations opens that same
dialog over the Settings screen (`screens/Settings/Settings.tsx`), so the editor
has one host. The draft state machine lives in `draft.ts` so the "untouched
slots follow the saved record, touched slots win" rule is testable on its own;
the editor's own test (`editor/DecorationsEditor.test.tsx`) drives the controls
against a host that keeps the draft, the way the dialog does.

An animated pick is uploaded on save (`useSaveDecorations`) before the record is
written, because a record can only name bytes that already exist. The upload is
not recompressed: transcoding would flatten the animation. `buildDecorationRecord`
in `records.ts` owns the read-modify-write merge: `putRecord` replaces the whole
record, so untouched slots must be carried over and cleared slots omitted. It
also enforces one name paint at a time, so a record can hold a custom gradient
or a custom solid or a preset, never two.

Color entry is a swatch plus a hex box (`DecorationColorField`), so the picker
never gets between the user and an exact value; the record stores `#rrggbb`.
Native opens `reanimated-color-picker` in a dialog. The web bundle bans
react-native-gesture-handler, which that picker imports, so the web field
(`index.web.tsx`) opens `@terrazzo/react-color-picker` - an OKLCH picker whose
channel sliders are WebGL2 - pinned to 0.3.0. That package's CSS follows the OS
color scheme and leaves semantic variables undefined, so `terrazzoTheme.ts`
maps them onto the active ALF theme while the dialog is open. Browsers without
WebGL2 (jsdom included) would unmount the dialog when the shader init throws,
so `canvasSupport.ts` gates it and those browsers get a transparent
`<input type="color">` over the swatch instead.

Two bundler footguns live in that picker's graph. `colorjs.io/fn` exports its
color spaces unregistered, and `@terrazzo/token-tools`' registration side effect
is deferred by Metro's inline requires, so `colorSpaces.ts` registers the CSS
Color 4 set at module scope instead. `@use-gesture` publishes ESM and CJS builds
that each own the gesture config registry, so `metro.config.ts` resolves the
`@use-gesture/core` root to the same build format Metro already picks for its
`actions` subpath; otherwise the first `useDrag` throws while parsing an
undefined resolver.

## Regenerating the font catalog

`node scripts/generate-google-fonts.mjs` rewrites `googleFonts.ts` from
`https://fonts.google.com/metadata/fonts` (latin subset, upright 400 face,
sorted by Google's popularity rank) and caches the download in `scripts/.cache/`.
Pass `--refresh` to re-download. Rerun it when Google adds or retires families;
faces are resolved by name at runtime, so no URL here can go stale.
