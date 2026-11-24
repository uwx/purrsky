import {type CSSProperties, useEffect, useRef} from 'react'
import type {AnimationItem, LottiePlayer} from 'lottie-web'

import {InlineSlot} from '#/features/bluemoji/InlineSlot.web'
import type {BluemojiLottieProps, InlineLottieProps} from './types'

let player: Promise<LottiePlayer> | undefined

/** The canvas build is ~50 kB gzipped and most pages show no animated emoji. */
function loadPlayer() {
  player ??= import('lottie-web/build/player/lottie_light_canvas').then(
    module => module.default,
  )
  return player
}

/**
 * A PDS sends no cache headers, so the browser will not reuse a blob on its
 * own, and one post can repeat the same emoji. Keep the last few documents.
 *
 * Text rather than parsed JSON: the player completes and mutates the document
 * it is given, so each animation needs its own copy.
 */
const documents = new Map<string, Promise<string>>()
const DOCUMENT_CACHE_SIZE = 32

function loadDocument(uri: string) {
  let document = documents.get(uri)
  if (!document) {
    document = fetch(uri).then(response => {
      if (!response.ok) throw new Error(`Lottie ${response.status}`)
      return response.text()
    })
    documents.set(uri, document)
    /* A failed load must not stick: the next mount deserves a fresh request. */
    document.catch(() => documents.delete(uri))
    if (documents.size > DOCUMENT_CACHE_SIZE) {
      const oldest = documents.keys().next().value
      if (oldest) documents.delete(oldest)
    }
  }
  return document
}

function Canvas({
  uri,
  autoplay,
  label,
  testID,
  onError,
  style,
}: Omit<BluemojiLottieProps, 'size'> & {style: CSSProperties}) {
  const element = useRef<HTMLDivElement>(null)
  const animation = useRef<AnimationItem | undefined>(undefined)
  const autoplayRef = useRef(autoplay)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    autoplayRef.current = autoplay
    const item = animation.current
    if (!item) return
    if (autoplay) item.play()
    else item.pause()
  }, [autoplay])

  useEffect(() => {
    const container = element.current
    if (!container) return
    let cancelled = false
    let created: AnimationItem | undefined
    let observer: ResizeObserver | undefined

    void Promise.all([loadPlayer(), loadDocument(uri)])
      .then(([Lottie, text]) => {
        if (cancelled) return
        created = Lottie.loadAnimation({
          container,
          renderer: 'canvas',
          loop: true,
          /* Started below, once the first frame is on the canvas. */
          autoplay: false,
          animationData: JSON.parse(text) as unknown,
        })
        animation.current = created
        created.addEventListener('error', () => onErrorRef.current?.())
        created.addEventListener('data_failed', () => onErrorRef.current?.())
        created.addEventListener('DOMLoaded', () => {
          /*
           * The canvas is a block element so it cannot add a baseline gap, and
           * it is rasterised again at the slot's settled size: an inline slot
           * only knows its box after the emoji font has been measured.
           */
          const canvas = container.querySelector('canvas')
          if (canvas) canvas.style.display = 'block'
          created?.resize()
          if (autoplayRef.current) created?.play()
        })
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => created?.resize())
          observer.observe(container)
        }
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.()
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      animation.current = undefined
      created?.destroy()
    }
  }, [uri])

  return (
    <div
      ref={element}
      role="img"
      aria-label={label}
      data-testid={testID}
      style={{display: 'block', ...style}}
    />
  )
}

/** A square rendition: picker tiles, settings rows, and the details popup. */
export function BluemojiLottie({size, ...props}: BluemojiLottieProps) {
  return <Canvas {...props} style={{width: size, height: size}} />
}

/** Runs inline with text, exactly where the emoji's glyph would have been. */
export function InlineLottie({
  size,
  baselineOffset: _baselineOffset,
  ...props
}: InlineLottieProps) {
  return (
    <InlineSlot size={size}>
      <Canvas {...props} style={{width: '100%', height: '100%'}} />
    </InlineSlot>
  )
}
