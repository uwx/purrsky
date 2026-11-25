/** @jest-environment jsdom */

import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {HexagonAvatar} from './HexagonAvatar'

jest.mock('react-native', () => jest.requireActual('react-native-web'))

function renderInto(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    createRoot(container).render(node)
  })
  return container
}

/*
 * A shared clip id breaks rendering: browsers resolve `url(#id)` to the first
 * matching element, and an inactive screen or a virtualized-off row can put
 * that match inside a `display: none` subtree, leaving the image unclipped.
 */
it('gives every mounted avatar its own clip id', () => {
  const container = renderInto(
    <>
      <div style={{display: 'none'}}>
        <HexagonAvatar uri="hidden.png" size={80} rounded stroke="#FFD700" />
      </div>
      <HexagonAvatar uri="visible.png" size={80} rounded stroke="#FFD700" />
    </>,
  )

  const svgs = Array.from(container.querySelectorAll('svg'))
  expect(svgs).toHaveLength(2)

  const ids = svgs.map(svg => svg.querySelector('clipPath')?.id)
  expect(ids[0]).toBeTruthy()
  expect(ids[1]).toBeTruthy()
  expect(ids[0]).not.toBe(ids[1])

  for (const svg of svgs) {
    const clipId = svg.querySelector('clipPath')?.id
    expect(svg.querySelector('image')?.getAttribute('clip-path')).toBe(
      `url(#${clipId})`,
    )
  }
})

/*
 * The stroke is a second copy of the path. If `shape` only reached the clip,
 * a triangle image would sit under a hexagon border.
 */
it('clips and strokes a triangle on the triangle path', () => {
  const container = renderInto(
    <>
      <HexagonAvatar
        uri="hex.png"
        size={80}
        rounded
        stroke="#FFD700"
        strokeWidth={2}
      />
      <HexagonAvatar
        uri="tri.png"
        size={80}
        rounded
        shape="triangle"
        stroke="#FFD700"
        strokeWidth={2}
      />
    </>,
  )

  /* Each avatar draws the clip path, then the stroke path inset by half the
   * stroke width. A triangle is three vertices, so three corner curves. */
  const quads = Array.from(container.querySelectorAll('svg')).map(svg =>
    Array.from(svg.querySelectorAll('path')).map(
      path => path.getAttribute('d')?.match(/Q/g)?.length,
    ),
  )

  expect(quads[0]).toEqual([6, 6])
  expect(quads[1]).toEqual([3, 3])
})
