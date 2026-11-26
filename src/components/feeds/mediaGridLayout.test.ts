import {packIntoStrips} from '#/components/feeds/mediaGridLayout'

const tiles = (...ratios: number[]) =>
  ratios.map(aspectRatio => ({aspectRatio}))

const sum = (strip: {aspectRatio: number}[]) =>
  strip.reduce((total, tile) => total + tile.aspectRatio, 0)

it('fills strips to about the target width and keeps every tile once', () => {
  const items = tiles(1, 1, 1, 1, 1, 1, 1, 1, 1)
  const strips = packIntoStrips(items, 3)
  expect(strips.map(strip => strip.length)).toEqual([3, 3, 3])
  expect(strips.flat()).toEqual(items)
})

it('keeps portrait media narrow instead of giving each tile a column', () => {
  const strips = packIntoStrips(tiles(0.5, 0.5, 0.5, 0.5, 0.5, 0.5), 3)
  expect(strips.map(strip => strip.length)).toEqual([6])
})

it('drops a lone narrow tile into the strip above rather than stretch it', () => {
  const strips = packIntoStrips(tiles(1, 1, 1, 0.5), 3)
  expect(strips.map(strip => strip.length)).toEqual([4])
  expect(sum(strips[0])).toBe(3.5)
})

it('leaves a last strip that is wide enough on its own', () => {
  const strips = packIntoStrips(tiles(1, 1, 1, 2), 3)
  expect(strips.map(strip => strip.length)).toEqual([3, 1])
})

it('handles an empty or single-tile grid', () => {
  expect(packIntoStrips([], 3)).toEqual([])
  expect(packIntoStrips(tiles(1.5), 3)).toEqual([[{aspectRatio: 1.5}]])
})

it('packs wider media into fewer tiles per strip', () => {
  const strips = packIntoStrips(tiles(2, 2, 2, 2, 2), 3)
  expect(strips.map(strip => strip.length)).toEqual([2, 2, 1])
})
