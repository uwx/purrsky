/** @jest-environment jsdom */

import {act} from 'react'
import {Text as RNText} from 'react-native'
import {createRoot} from 'react-dom/client'

import {Text} from '#/components/Typography'
import {getTagGradient} from './tag-gradients'

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/logger', () => ({logger: {warn: () => {}}}))
jest.mock('#/env', () => ({IS_WEB: true, IS_IOS: false, IS_NATIVE: false}))
jest.mock('#/alf', () => ({
  atoms: {text_sm: {fontSize: 14}, leading_snug: {lineHeight: 1.25}},
  native: () => undefined,
  platform: () => undefined,
  utils: {alpha: (color: string) => color},
  useAlf: () => ({
    fonts: {scaleMultiplier: 1, family: 'system', letterSpacing: 0},
    flags: {},
  }),
  useTheme: () => ({
    atoms: {text: {color: '#111111'}},
    palette: {primary_500: '#ed5345'},
  }),
  web: (value: unknown) => value,
}))
jest.mock('#/alf/typography', () => ({
  childHasEmoji: () => false,
  normalizeTextStyles: (styles: unknown[]) =>
    Object.assign({}, ...styles.flat(Infinity).filter(Boolean)),
  renderChildrenWithEmoji: (children: React.ReactNode) => children,
}))

it('paints a tag gradient through nested tag markup', () => {
  /*
   * RichTextTag nests the tag text in its own span on web, so the gradient has
   * to survive a non-string child, not just a bare string.
   */
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    createRoot(container).render(
      <Text
        style={{color: '#ff0000'}}
        gradient={getTagGradient('trans', 'light')}>
        <RNText>#transgender</RNText>
      </Text>,
    )
  })

  const tag = container.firstElementChild as HTMLElement
  expect(tag.style.backgroundClip || tag.style.webkitBackgroundClip).toBe(
    'text',
  )
  /* The callers pass a theme color for the tag; the gradient must paint over it. */
  // The browser normalizes `transparent` to a zero-alpha color.
  expect(tag.style.color).toBe('rgba(0, 0, 0, 0)')
  expect(tag.style.backgroundImage).toContain('linear-gradient(90deg, ')
  expect((tag.firstElementChild as HTMLElement).textContent).toBe(
    '#transgender',
  )
})
