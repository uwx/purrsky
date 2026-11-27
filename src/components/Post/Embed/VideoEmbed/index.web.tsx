import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {getCurrentState, useOnAppStateChange} from '#/lib/appState'
import {createPlaybackDurationTracker} from '#/lib/media/video/analytics'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {atoms as a, useTheme} from '#/alf'
import {useIsWithinMessage} from '#/components/dms/MessageContext'
import {useFullscreen} from '#/components/hooks/useFullscreen'
import {ConstrainedImage} from '#/components/images/AutoSizedImage'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {
  HLSFatalError,
  HLSUnsupportedError,
  VideoEmbedInnerWeb,
  VideoNotFoundError,
} from '#/components/Post/Embed/VideoEmbed/VideoEmbedInner/VideoEmbedInnerWeb'
import {useAnalytics} from '#/analytics'
import {type app} from '#/lexicons'
import {useActiveVideoWeb} from './ActiveVideoWebContext'
import {useVideoDownload} from './useVideoDownload'
import * as VideoFallback from './VideoEmbedInner/VideoFallback'
import {usePictureInPicture} from './VideoEmbedInner/web-controls/usePictureInPicture'

const noop = () => {}
const MIN_CARD_WIDTH = 320

export function VideoEmbed({
  embed,
  post,
  hidden = false,
}: {
  embed: app.bsky.embed.video.View
  post?: app.bsky.feed.defs.PostView
  hidden?: boolean
}) {
  const dims = embed.aspectRatio
  const rawRatio = dims ? dims.width / dims.height : undefined
  const aspectRatio = Number.isNaN(rawRatio) ? undefined : rawRatio
  const constrained = aspectRatio === undefined ? 1 : Math.max(aspectRatio, 1 / 2)
  const [containerWidth, setContainerWidth] = useState(0)
  const videoState = useActiveVideoWeb()

  /* Portrait cards need room for the controls; unknown and very tall videos stay boxed. */
  const cardWidth = containerWidth * Math.min(aspectRatio ?? 1, 1)
  const fullBleed =
    aspectRatio === undefined ||
    aspectRatio < 1 / 2 ||
    (containerWidth > 0 && cardWidth < MIN_CARD_WIDTH)

  return (
    <View
      style={a.pt_xs}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
      <ViewportObserver
        sendPosition={
          hidden || embed.presentation === 'gif' ? noop : videoState.sendPosition
        }
        isAnyViewActive={videoState.currentActiveView !== null}>
        <ConstrainedImage
          fullBleed={fullBleed}
          aspectRatio={constrained || 1}
          minMobileAspectRatio={14 / 9}>
          {hidden ? (
            <Image
              source={embed.thumbnail}
              contentFit="contain"
              style={[a.w_full, a.h_full]}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <VideoPlayer
              embed={embed}
              post={post}
              fullBleed={fullBleed}
              videoState={videoState}
            />
          )}
        </ConstrainedImage>
      </ViewportObserver>
    </View>
  )
}

function VideoPlayer({
  embed,
  post,
  fullBleed,
  videoState,
}: {
  embed: app.bsky.embed.video.View
  post?: app.bsky.feed.defs.PostView
  fullBleed: boolean
  videoState: ReturnType<typeof useActiveVideoWeb>
}) {
  const t = useTheme()
  const onDownload = useVideoDownload({
    did: post?.author.did,
    cid: embed.cid,
    post,
  })
  const ref = useRef<HTMLDivElement>(null)
  const {active: activeFromContext, setActive, sendPosition} = videoState
  const [onScreen, setOnScreen] = useState(false)
  const [meaningfullyVisible, setMeaningfullyVisible] = useState(false)
  const [isFullscreen] = useFullscreen()
  const lastKnownTime = useRef<number | undefined>(undefined)
  const impressionTrackedRef = useRef(false)
  const playbackStartTrackedRef = useRef(false)
  const ax = useAnalytics()

  const isGif = embed.presentation === 'gif'
  // GIFs don't participate in the "one video at a time" system
  const active = isGif || activeFromContext
  const [durationTracker] = useState(() => {
    const tracker = createPlaybackDurationTracker({
      enabled: !isGif,
      onSegment: segment => {
        ax.metric('video:playback:duration', {
          ...segment,
          postUri: post?.uri,
          postAuthorDid: post?.author.did,
          context: 'embed',
          presentation: isGif ? 'gif' : 'video',
        })
      },
    })
    tracker.setForeground(getCurrentState() === 'active')
    return tracker
  })

  useOnAppStateChange(state => {
    durationTracker.setForeground(state === 'active')
  })

  useEffect(() => {
    durationTracker.setActive(active && onScreen)
  }, [active, durationTracker, onScreen])

  useEffect(() => {
    return () => durationTracker.flush('unmounted')
  }, [durationTracker])

  useEffect(() => {
    if (!meaningfullyVisible || impressionTrackedRef.current) return
    impressionTrackedRef.current = true
    ax.metric('video:impression', {
      postUri: post?.uri,
      postAuthorDid: post?.author.did,
      context: 'embed',
      presentation: isGif ? 'gif' : 'video',
    })
  }, [ax, isGif, meaningfullyVisible, post?.author.did, post?.uri])

  useEffect(() => {
    if (!ref.current) return
    // paused while fullscreen - see ViewportObserver
    if (isFullscreen) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        setOnScreen(entry.isIntersecting)
        setMeaningfullyVisible(
          entry.isIntersecting && entry.intersectionRatio >= 0.5,
        )
        // GIFs don't send position - they don't compete to be the active video
        if (!isGif) {
          sendPosition(
            entry.boundingClientRect.y + entry.boundingClientRect.height / 2,
          )
        }
      },
      {threshold: 0.5},
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [sendPosition, isFullscreen, isGif])

  const [key, setKey] = useState(0)
  const renderError = useCallback(
    (error: unknown) => (
      <VideoError embed={embed} error={error} retry={() => setKey(key + 1)} />
    ),
    [key, embed],
  )
  const getErrorMetadata = useCallback((error: Error) => {
    if (!(error instanceof HLSFatalError)) return {}
    return {
      tags: {
        hls_error_detail: error.detail,
        hls_error_type: error.type,
      },
      hls: error.diagnostics,
    }
  }, [])

  const contents = (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flex: 1,
        cursor: 'default',
        position: 'relative',
        backgroundColor: t.palette.black,
        backgroundImage: `url(${embed.thumbnail})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      onClick={evt => evt.stopPropagation()}>
      {fullBleed && embed.thumbnail && (
        <>
          {/* blurred backdrop fills the bars when the video is boxed */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${embed.thumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(32px)',
              // hide the transparent fade the blur creates at the edges
              transform: 'scale(1.2)',
            }}
          />
          {/* redraw the sharp thumbnail above the blur */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${embed.thumbnail})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </>
      )}
      <ErrorBoundary
        renderError={renderError}
        getErrorMetadata={getErrorMetadata}
        key={key}>
        <OnlyNearScreen>
          <VideoEmbedInnerWeb
            embed={embed}
            onDownload={onDownload}
            active={active}
            setActive={setActive}
            onScreen={onScreen}
            lastKnownTime={lastKnownTime}
            onPlaybackStart={autoplay => {
              if (playbackStartTrackedRef.current) return
              playbackStartTrackedRef.current = true
              ax.metric('video:playback:start', {
                postUri: post?.uri,
                postAuthorDid: post?.author.did,
                context: 'embed',
                presentation: isGif ? 'gif' : 'video',
                autoplay,
              })
            }}
            onPlaybackProgress={progressSeconds => {
              durationTracker.observeProgress(progressSeconds)
            }}
            onPlaybackStateChange={state => {
              durationTracker.setBuffering(state === 'buffering')
              durationTracker.setPlaying(state === 'playing')
            }}
            onPlaybackEnd={() => durationTracker.flush('ended')}
          />
        </OnlyNearScreen>
      </ErrorBoundary>
    </div>
  )

  return (
    <>
      {contents}
      <MediaInsetBorder />
    </>
  )
}

const NearScreenContext = createContext(false)
NearScreenContext.displayName = 'VideoNearScreenContext'

/**
 * Renders a 100vh tall div and watches it with an IntersectionObserver to
 * send the position of the div when it's near the screen.
 *
 * IMPORTANT: ViewportObserver _must_ not be within a `overflow: hidden` container.
 */
function ViewportObserver({
  children,
  sendPosition,
  isAnyViewActive,
}: {
  children: React.ReactNode
  sendPosition: (position: number) => void
  isAnyViewActive: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [nearScreen, setNearScreen] = useState(false)
  const [isFullscreen] = useFullscreen()
  const isWithinMessage = useIsWithinMessage()

  // Send position when scrolling. This is done with an IntersectionObserver
  // observing a div of 100vh height
  useEffect(() => {
    if (!ref.current) return
    /*
     * Pause while any video is fullscreen. Fullscreen resizes the window, so
     * the page behind the video can reflow into another layout (e.g. mobile to
     * desktop) and move this embed offscreen. Observing that would unmount the
     * fullscreen player via OnlyNearScreen, which exits fullscreen.
     */
    if (isFullscreen) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        const position =
          entry.boundingClientRect.y + entry.boundingClientRect.height / 2
        sendPosition(position)
        setNearScreen(entry.isIntersecting)
      },
      {threshold: Array.from({length: 101}, (_, i) => i / 100)},
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [sendPosition, isFullscreen])

  // In case scrolling hasn't started yet, send up the position
  useEffect(() => {
    if (ref.current && !isAnyViewActive) {
      const rect = ref.current.getBoundingClientRect()
      const position = rect.y + rect.height / 2
      sendPosition(position)
    }
  }, [isAnyViewActive, sendPosition])

  return (
    <View style={[a.flex_1, a.flex_row]}>
      <NearScreenContext.Provider value={nearScreen}>
        {children}
      </NearScreenContext.Provider>
      <div
        ref={ref}
        style={{
          // Don't escape bounds when in a message
          ...(isWithinMessage
            ? {top: 0, height: '100%'}
            : {top: 'calc(50% - 50vh)', height: '100vh'}),
          position: 'absolute',
          left: '50%',
          width: 1,
          pointerEvents: 'none',
        }}
      />
    </View>
  )
}

/**
 * Awkward data flow here, but we need to hide the video when it's not near the screen.
 * But also, ViewportObserver _must_ not be within a `overflow: hidden` container.
 * So we put it at the top level of the component tree here, then hide the children of
 * the auto-resizing container.
 */
export const OnlyNearScreen = ({children}: {children: React.ReactNode}) => {
  const nearScreen = useContext(NearScreenContext)

  const ref = useRef<HTMLDivElement>(null)
  const pictureInPictureElement = usePictureInPicture()
  const keepMounted =
    pictureInPictureElement !== null &&
    !!ref.current?.contains(pictureInPictureElement)

  return (
    <div ref={ref} style={{display: 'contents'}}>
      {nearScreen || keepMounted ? children : null}
    </div>
  )
}

function VideoError({
  embed,
  error,
  retry,
}: {
  embed: app.bsky.embed.video.View
  error: unknown
  retry: () => void
}) {
  const {_} = useLingui()
  const ax = useAnalytics()

  let showRetryButton = true
  let text = null
  let errorClass: string

  if (error instanceof VideoNotFoundError) {
    text = _(msg`Video not found.`)
    errorClass = 'VideoNotFoundError'
  } else if (error instanceof HLSUnsupportedError) {
    showRetryButton = false
    text = _(
      msg`This video can’t be played on your device. Your browser or system may be missing the required video codecs (H.264/AAC).`,
    )
    errorClass = 'HLSUnsupportedError'
  } else {
    text = _(msg`An error occurred while loading the video. Please try again.`)
    if (error instanceof HLSFatalError) {
      errorClass = error.detail
    } else if (error instanceof Error) {
      errorClass = error.name || 'Error'
    } else {
      errorClass = 'Unknown'
    }
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  const presentation = embed.presentation === 'gif' ? 'gif' : 'video'
  const playlist = embed.playlist
  /*
   * Fire exactly once per failure - the analytics context identity can change
   * (session/geolocation updates) while this fallback stays mounted, which
   * would otherwise re-run the effect and double-count.
   */
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    ax.metric('video:playback:failed', {
      surface: 'feed',
      presentation,
      errorClass,
      errorMessage: errorMessage.slice(0, 256),
      playlist,
    })
  }, [ax, presentation, playlist, errorClass, errorMessage])

  return (
    <VideoFallback.Container>
      <VideoFallback.Text>{text}</VideoFallback.Text>
      {showRetryButton && <VideoFallback.RetryButton onPress={retry} />}
    </VideoFallback.Container>
  )
}
