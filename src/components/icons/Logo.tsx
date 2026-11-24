import {View} from 'react-native'
import Svg, {G, Path} from 'react-native-svg'

import {Logotype} from '#/view/icons/Logotype'
import {MARK_PATH} from '#/view/icons/mark'
import {
  DRAWN_NAME,
  LETTERFORMS,
  WORDMARK_CAP_HEIGHT,
  WORDMARK_INK_LEFT,
  WORDMARK_INK_WIDTH,
} from '#/view/icons/wordmark'
import {APP_NAME} from '#/env'
import {type Props, useCommonSVGProps} from './common'

/*
 * Lockup geometry, all relative to a 123 unit tall canvas: the mark's ink is
 * 352x373 inside its 512 unit box, set 96 units tall, and the wordmark's cap
 * height is 66 units with a 34 unit optical gap. Keeping the fractions lets
 * `<Full width={120}>` stay proportional at any size.
 */
const MARK_INK = {x: 80, y: 91, width: 352, height: 373}
const LOCKUP_HEIGHT = 123
const MARK_HEIGHT = 96
const WORDMARK_HEIGHT = 66
const WORDMARK_GAP = 34

const MARK_SCALE = MARK_HEIGHT / MARK_INK.height
const WORDMARK_SCALE = WORDMARK_HEIGHT / WORDMARK_CAP_HEIGHT
const MARK_WIDTH = MARK_INK.width * MARK_SCALE
const LOCKUP_WIDTH =
  MARK_WIDTH + WORDMARK_GAP + WORDMARK_INK_WIDTH * WORDMARK_SCALE

const MARK_TRANSFORM = [
  `translate(${(-MARK_INK.x * MARK_SCALE).toFixed(3)}`,
  `${((LOCKUP_HEIGHT - MARK_HEIGHT) / 2 - MARK_INK.y * MARK_SCALE).toFixed(3)})`,
  `scale(${MARK_SCALE.toFixed(6)})`,
].join(' ')
const WORDMARK_TRANSFORM = [
  `translate(${(MARK_WIDTH + WORDMARK_GAP - WORDMARK_INK_LEFT * WORDMARK_SCALE).toFixed(3)}`,
  `${((LOCKUP_HEIGHT - WORDMARK_HEIGHT) / 2).toFixed(3)})`,
  `scale(${WORDMARK_SCALE.toFixed(6)})`,
].join(' ')

/**
 * The mark and the wordmark side by side. The wordmark is drawn outlines of
 * `DRAWN_NAME`; a deployment that renames the app gets the mark plus the name
 * set as text instead of outlines spelling the wrong product.
 */
export function Full(
  props: Omit<Props, 'fill' | 'size' | 'height'> & {
    markFill?: Props['fill']
    textFill?: Props['fill']
  },
) {
  const {fill, width, height, viewBox, style, gradient, ...rest} =
    useCommonSVGProps(
      props,
      `0 0 ${LOCKUP_WIDTH.toFixed(2)} ${LOCKUP_HEIGHT}`,
    )

  if (APP_NAME !== DRAWN_NAME) {
    const capHeight = (height * WORDMARK_HEIGHT) / LOCKUP_HEIGHT
    const markHeight = (height * MARK_HEIGHT) / LOCKUP_HEIGHT
    const markWidth = (markHeight * MARK_INK.width) / MARK_INK.height
    return (
      <View
        style={[
          {flexDirection: 'row', alignItems: 'center'},
          {columnGap: (height * WORDMARK_GAP) / LOCKUP_HEIGHT},
          style,
        ]}>
        <Svg
          fill="none"
          viewBox={`${MARK_INK.x} ${MARK_INK.y} ${MARK_INK.width} ${MARK_INK.height}`}
          width={markWidth}
          height={markHeight}>
          <Path fill={props.markFill ?? fill} d={MARK_PATH} />
        </Svg>
        <Logotype
          fill={props.textFill ?? fill}
          width={capHeight * (95 / WORDMARK_CAP_HEIGHT)}
        />
      </View>
    )
  }

  return (
    <Svg
      fill="none"
      {...rest}
      viewBox={viewBox}
      width={width}
      height={height}
      style={[style]}>
      {gradient}
      <G transform={MARK_TRANSFORM}>
        <Path fill={props.markFill ?? fill} d={MARK_PATH} />
      </G>
      <G transform={WORDMARK_TRANSFORM}>
        {LETTERFORMS.map(d => (
          <Path key={d} fill={props.textFill ?? fill} d={d} />
        ))}
      </G>
    </Svg>
  )
}
