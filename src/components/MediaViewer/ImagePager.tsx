import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {useA11y} from '#/state/a11y'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {isEditableTarget} from '#/components/Gallery/domUtils'
import {
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeft,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRight,
} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

export type ViewerImage = {
  uri: string
  alt: string
  aspectRatio?: {width: number; height: number}
}

type Size = {width: number; height: number}

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.trunc(index) || 0))
}

export function ImagePager({
  images,
  initialIndex,
  onClose,
  toolbarCenter,
}: {
  images: ViewerImage[]
  initialIndex: number
  onClose: () => void
  toolbarCenter?: React.ReactNode
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {reduceMotionEnabled} = useA11y()
  const nativeID = useId()
  const [index, setIndex] = useState(() => clampIndex(initialIndex, images.length))
  const [size, setSize] = useState<Size>({width: 0, height: 0})
  const [showAlt, setShowAlt] = useState(false)
  const indexRef = useRef(index)
  const sizeRef = useRef(size)
  const offset = useRef(new Animated.Value(0)).current
  const currentOffset = useRef(0)
  const dragOrigin = useRef(0)
  const blockGesture = useRef(false)
  const lastDragEnd = useRef(0)

  useEffect(() => {
    const listener = offset.addListener(({value}) => {
      currentOffset.current = value
    })
    return () => {
      offset.stopAnimation()
      offset.removeListener(listener)
    }
  }, [offset])

  const goTo = useCallback(
    (requestedIndex: number) => {
      const next = clampIndex(requestedIndex, images.length)
      indexRef.current = next
      setIndex(next)
      offset.stopAnimation()
      const destination = -next * sizeRef.current.width
      if (reduceMotionEnabled) {
        offset.setValue(destination)
      } else {
        Animated.timing(offset, {
          toValue: destination,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start()
      }
    },
    [images.length, offset, reduceMotionEnabled],
  )

  useEffect(() => {
    if (indexRef.current >= images.length) goTo(images.length - 1)
  }, [images.length, goTo])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          blockGesture.current = false
          return false
        },
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          !blockGesture.current &&
          gesture.numberActiveTouches === 1 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          offset.stopAnimation()
          dragOrigin.current = currentOffset.current
        },
        onPanResponderMove: (_event, gesture) => {
          const width = sizeRef.current.width
          const proposed = dragOrigin.current + gesture.dx
          offset.setValue(
            Math.max(-(images.length - 1) * width, Math.min(0, proposed)),
          )
        },
        onPanResponderRelease: (_event, gesture) => {
          lastDragEnd.current = Date.now()
          const threshold = Math.min(80, sizeRef.current.width * 0.2)
          const direction =
            Math.abs(gesture.dx) >= threshold ||
            (Math.abs(gesture.dx) > 16 && Math.abs(gesture.vx) > 0.5)
              ? gesture.dx < 0
                ? 1
                : -1
              : 0
          goTo(indexRef.current + direction)
        },
        onPanResponderTerminate: () => {
          lastDragEnd.current = Date.now()
          goTo(indexRef.current)
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [goTo, images.length, offset],
  )

  useEffect(() => {
    if (!IS_WEB) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return
      }
      const root = document.getElementById(nativeID)
      if (!root) return
      const scope = root.closest('[role="dialog"]') || root
      if (
        document.activeElement !== document.body &&
        !scope.contains(document.activeElement)
      ) {
        return
      }
      // Portalled menus and nested dialogs own their keyboard interactions.
      const overlays = document.querySelectorAll<HTMLElement>(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      )
      for (const overlay of overlays) {
        if (
          !overlay.contains(root) &&
          !overlay.closest('[aria-hidden="true"]') &&
          overlay.getClientRects().length > 0
        ) {
          return
        }
      }
      event.preventDefault()
      goTo(indexRef.current + (event.key === 'ArrowRight' ? 1 : -1))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [goTo, nativeID])

  const current = images[index]
  const position = images.length ? index + 1 : 0
  const total = images.length

  return (
    <View
      nativeID={nativeID}
      testID="mediaViewerImagePager"
      style={[a.flex_1, {minHeight: 0}]}>
      <View
        style={[
          a.flex_1,
          a.overflow_hidden,
          {minHeight: 0, backgroundColor: '#000'},
        ]}
        onLayout={event => {
          const {width, height} = event.nativeEvent.layout
          if (
            width === sizeRef.current.width &&
            height === sizeRef.current.height
          ) {
            return
          }
          const nextSize = {width, height}
          sizeRef.current = nextSize
          offset.stopAnimation()
          offset.setValue(-indexRef.current * width)
          currentOffset.current = -indexRef.current * width
          setSize(nextSize)
        }}>
        <View
          style={[
            a.absolute,
            a.inset_0,
            web({touchAction: 'pan-y', userSelect: 'none'}),
          ]}
          {...panResponder.panHandlers}>
          {size.width > 0 && size.height > 0 && (
            <Animated.View
              style={[
                a.flex_row,
                {
                  width: size.width * images.length,
                  height: size.height,
                  transform: [{translateX: offset}],
                },
              ]}>
              {images.map((image, pageIndex) => (
                <ImagePage
                  key={`${pageIndex}:${image.uri}`}
                  image={image}
                  size={size}
                  active={pageIndex === index}
                  onBackgroundPress={() => {
                    // RN web can synthesize a click after a mouse/touch drag.
                    if (Date.now() - lastDragEnd.current > 350) onClose()
                  }}
                  onControlPressIn={() => {
                    blockGesture.current = true
                  }}
                />
              ))}
            </Animated.View>
          )}
        </View>
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            a.align_center,
            {top: 12, left: 64, right: 64},
          ]}>
          <Text
            testID="mediaViewerImagePosition"
            accessibilityLiveRegion="polite"
            style={[
              a.text_sm,
              a.px_sm,
              a.py_xs,
              a.rounded_full,
              {color: '#fff', backgroundColor: 'rgba(0, 0, 0, 0.7)'},
            ]}>
            <Trans>{position} of {total}</Trans>
          </Text>
        </View>
      </View>
      {showAlt && current?.alt ? (
        <ScrollView
          style={[t.atoms.bg, {maxHeight: 160}]}
          contentContainerStyle={[a.p_md]}>
          <Text selectable style={[a.text_sm, t.atoms.text]}>
            {current.alt}
          </Text>
        </ScrollView>
      ) : null}
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.gap_sm,
          a.p_sm,
          t.atoms.bg,
        ]}>
        <Button
          testID="mediaViewerPreviousImage"
          label={l`Previous image`}
          size="small"
          color="secondary"
          shape="round"
          disabled={index <= 0}
          onPress={() => goTo(indexRef.current - 1)}>
          <ButtonIcon icon={ChevronLeft} />
        </Button>
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.justify_center,
            a.gap_sm,
            {minWidth: 0},
          ]}>
          {toolbarCenter}
          {current?.alt ? (
            <Button
              testID="mediaViewerAltToggle"
              label={showAlt ? l`Hide alt text` : l`Show alt text`}
              accessibilityState={{expanded: showAlt}}
              size="small"
              color="secondary"
              onPress={() => setShowAlt(value => !value)}>
              <ButtonText>
                <Trans>ALT</Trans>
              </ButtonText>
            </Button>
          ) : null}
        </View>
        <Button
          testID="mediaViewerNextImage"
          label={l`Next image`}
          size="small"
          color="secondary"
          shape="round"
          disabled={index >= images.length - 1}
          onPress={() => goTo(indexRef.current + 1)}>
          <ButtonIcon icon={ChevronRight} />
        </Button>
      </View>
    </View>
  )
}

function ImagePage({
  image,
  size,
  active,
  onBackgroundPress,
  onControlPressIn,
}: {
  image: ViewerImage
  size: Size
  active: boolean
  onBackgroundPress: () => void
  onControlPressIn: () => void
}) {
  const {t: l} = useLingui()
  const [loadedSize, setLoadedSize] = useState<Size>()
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const dimensions = loadedSize || image.aspectRatio
  const ratio =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? dimensions.width / dimensions.height
      : size.width / size.height
  const width = Math.min(size.width, size.height * ratio)
  const height = Math.min(size.height, size.width / ratio)

  return (
    <Pressable
      accessible={false}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'}
      onPress={onBackgroundPress}
      style={[a.align_center, a.justify_center, size]}>
      <Pressable
        accessible={false}
        onPress={event => event.stopPropagation()}
        style={{width, height}}>
        <Image
          key={attempt}
          testID={active ? 'mediaViewerCurrentImage' : undefined}
          source={{uri: image.uri}}
          contentFit="contain"
          draggable={false}
          style={[a.w_full, a.h_full]}
          accessible={active}
          accessibilityLabel={image.alt || l`Image`}
          accessibilityIgnoresInvertColors
          onLoad={event => {
            setLoadedSize({
              width: event.source.width,
              height: event.source.height,
            })
            setStatus('loaded')
          }}
          onError={() => setStatus('error')}
        />
      </Pressable>
      {status === 'loading' ? (
        <View
          pointerEvents="none"
          style={[a.absolute, a.align_center, a.gap_sm]}>
          <ActivityIndicator color="#fff" accessibilityLabel={l`Loading image`} />
          <Text style={[a.text_sm, {color: '#fff'}]}>
            <Trans>Loading image…</Trans>
          </Text>
        </View>
      ) : status === 'error' ? (
        <View style={[a.absolute, a.align_center, a.gap_sm, a.p_md]}>
          <Text accessibilityLiveRegion="polite" style={{color: '#fff'}}>
            <Trans>Unable to load image</Trans>
          </Text>
          <Button
            label={l`Retry loading image`}
            size="small"
            color="secondary"
            onPressIn={onControlPressIn}
            onPress={event => {
              event.stopPropagation()
              setStatus('loading')
              setAttempt(value => value + 1)
            }}>
            <ButtonText>
              <Trans>Retry</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}
    </Pressable>
  )
}
