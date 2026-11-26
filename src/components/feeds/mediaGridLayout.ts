/**
 * Something the media grid lays out, described by its width divided by height.
 * Kept free of React so the packing can be tested without a renderer.
 */
export type AspectRatioItem = {aspectRatio: number}

/**
 * Packs tiles into strips that each span the full width, in feed order.
 *
 * Every tile in a strip gets a width proportional to its aspect ratio, so all
 * of them come out the same height and the strip has a flat bottom edge. That
 * is what lets consecutive blocks of the grid sit flush: a block is one list
 * row, so a column layout would leave the room the short column did not use as
 * a hole above the next block.
 *
 * `columns` is how much aspect ratio a strip Holds, not how many tiles it has:
 * that keeps the grid as dense as a `columns`-wide one whether the media is
 * landscape or portrait.
 */
export function packIntoStrips<T extends AspectRatioItem>(
  items: T[],
  columns: number,
): T[][] {
  const strips: T[][] = []
  let index = 0
  while (index < items.length) {
    let width = 0
    let end = index
    let closest = Infinity
    for (let i = index; i < items.length; i++) {
      width += items[i].aspectRatio
      const distance = Math.abs(width - columns)
      /* On a tie, take the crowded strip: a short one leaves a hole. */
      if (distance <= closest) {
        closest = distance
        end = i + 1
      }
      /* Past the target a strip only gets emptier, so stop looking. */
      if (width >= columns) break
    }
    strips.push(items.slice(index, end))
    index = end
  }

  /*
   * A lone narrow tile at the end would stretch into a full-width banner.
   * Widening the strip above instead only makes its tiles a little smaller.
   */
  const last = strips[strips.length - 1]
  if (strips.length > 1 && last) {
    const lastWidth = last.reduce((sum, item) => sum + item.aspectRatio, 0)
    if (lastWidth < columns / 2) {
      for (const item of last) strips[strips.length - 2].push(item)
      strips.pop()
    }
  }

  return strips
}
