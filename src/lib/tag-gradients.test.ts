import {chroma} from '#/platform/chroma-formats'
import {getTagGradient} from './tag-gradients'

/**
 * LCH lightness, in the 0-100 range chroma-js exposes.
 */
function lightness(color: string) {
  return chroma(color).lch()[0]
}

it('matches tags case-insensitively', () => {
  expect(getTagGradient('Trans', 'light')?.colors).toEqual(
    getTagGradient('trans', 'light')?.colors,
  )
  expect(getTagGradient('TRANS', 'light')?.colors).toHaveLength(5)
})

it('ignores tags without a gradient', () => {
  expect(getTagGradient('witchsky', 'light')).toBeUndefined()
  expect(getTagGradient('', 'light')).toBeUndefined()
})

it('keeps the stylesheet cascade for repeated tags', () => {
  expect(getTagGradient('aromantic', 'light')?.colors).toHaveLength(5)
  expect(getTagGradient('aro', 'light')?.colors).toHaveLength(4)
})

it('lifts colorful stops into a readable mid lightness', () => {
  const colors = getTagGradient('bisexual', 'light')!.colors
  expect(colors).toHaveLength(3)
  for (const color of colors) expect(lightness(color)).toBeCloseTo(45, 0)
})

it('moves achromatic stops apart from the page background', () => {
  const light = getTagGradient('trans', 'light')!.colors
  const dark = getTagGradient('trans', 'dark')!.colors

  /*
   * The middle stop is white in the flag, so it goes to the "lighter" target
   * in light mode and further up in dark mode, where the page is dark.
   */
  expect(lightness(light[2])).toBeCloseTo(62, 0)
  expect(lightness(dark[2])).toBeCloseTo(78, 0)
})

it('lightens the black stops instead of leaving them invisible', () => {
  const light = getTagGradient('asexual', 'light')!.colors
  const dark = getTagGradient('asexual', 'dark')!.colors

  expect(lightness(light[0])).toBeCloseTo(34, 0)
  expect(lightness(dark[0])).toBeCloseTo(48, 0)
  expect(lightness(light[1])).toBeCloseTo(62, 0)
})

it('flattens translucent stops to opaque hex', () => {
  const colors = getTagGradient('heterosexual', 'light')!.colors
  for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/)
  // The joke flag stays faint instead of disappearing into the page.
  expect(chroma(colors[0]).get('lch.l')).toBeGreaterThan(80)
  const dark = getTagGradient('heterosexual', 'dark')!.colors
  expect(chroma(dark[0]).get('lch.l')).toBeLessThan(30)
})

it('resolves multi-word tag spellings from the stylesheet', () => {
  expect(getTagGradient('actually autistic', 'light')?.colors).toHaveLength(5)
  expect(getTagGradient('Autism Awareness', 'light')?.colors).toHaveLength(5)
})
