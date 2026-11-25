import {useEffect, useLayoutEffect, useRef, useState} from 'react'

import {useEmojiFont} from '#/state/preferences/emoji-font/context'

/** Emoji the browser draws from the same font as the surrounding text. */
const PROBE = '🟦'

export type InlineSlotBox = {
  /** Width of the glyph's advance, which the slot reserves. */
  width: number
  /** Height of the glyph's content box, which the media fills. */
  height: number
  /** Distance from the slot's bottom up to the glyph's content bottom. */
  offsetBottom: number
}

/**
 * Reserves an emoji's advance inside a run of text and draws a square media
 * box on exactly the glyph's ink, so a picture or animation sits where the
 * font would have drawn the emoji.
 *
 * The size comes from what the browser actually paints rather than from the
 * font size: an emoji's ink is taller and wider than its nominal size, and the
 * ratio depends on the emoji font in use, so the glyph itself is the only
 * reliable measurement. Native reads the same numbers from `onTextLayout`.
 */
export function InlineSlot({
  size,
  children,
}: {
  /** Font size of the surrounding text; only a re-measure trigger here. */
  size: number
  children: React.ReactNode
}) {
  const emojiFont = useEmojiFont()
  const probe = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<InlineSlotBox>()

  /*
   * The probe's element box is the line box, which a line-height pads with
   * leading. A range over its text is the glyph's own content box instead, and
   * the gap between the two bottoms is the leading the media has to step over.
   */
  const measure = () => {
    const element = probe.current
    if (!element) return
    const range = document.createRange()
    range.selectNodeContents(element)
    const glyph = range.getBoundingClientRect()
    if (!glyph.width || !glyph.height) return
    const offsetBottom = element.getBoundingClientRect().bottom - glyph.bottom

    setBox(previous =>
      previous?.width === glyph.width &&
      previous.height === glyph.height &&
      previous.offsetBottom === offsetBottom
        ? previous
        : {width: glyph.width, height: glyph.height, offsetBottom},
    )
  }

  useLayoutEffect(measure, [size, emojiFont])

  // A webfont can land after first paint; measure again when it does.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) measure()
    })
    return () => {
      cancelled = true
    }
  }, [size, emojiFont])

  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        verticalAlign: 'baseline',
        // Until the first measurement the probe alone holds the slot open, so
        // there is no layout jump - only the media appearing.
        ...(box && {width: box.width, height: box.height}),
      }}>
      {/* In flow, so the browser sizes it exactly like the emoji beside it. */}
      <span
        ref={probe}
        aria-hidden
        style={{
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
        {PROBE}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: box?.offsetBottom ?? 0,
          left: '50%',
          transform: 'translateX(-50%)',
          /*
           * Square, as tall as the glyph. The slot is a little wider than the
           * glyph (emoji advances include side bearings), so taking the height
           * rather than the width keeps the media from looking larger than the
           * real emoji.
           */
          width: box?.height ?? '100%',
          height: box?.height ?? '100%',
          /*
           * Without this the media is an inline-level child of a line box that
           * inherits the post's line-height, so the browser drops it onto the
           * text baseline and it paints a full line leading below the glyph.
           */
          display: 'flex',
        }}>
        {children}
      </span>
    </span>
  )
}
