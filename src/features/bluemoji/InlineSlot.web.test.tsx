/** @jest-environment jsdom */

import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {InlineSlot} from './InlineSlot.web'

jest.mock('#/state/preferences/emoji-font/context', () => ({
  useEmojiFont: () => 'system',
}))

/*
 * jsdom has no layout engine and does not implement `Range#getBoundingClientRect`
 * at all, so the slot's measurement throws before it can settle a box. An empty
 * rect is what the component already handles: it stays with its unsettled size.
 */
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }) as DOMRect
}

function render() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() =>
    root.render(
      <InlineSlot size={16}>
        <div data-testid="media" />
      </InlineSlot>,
    ),
  )
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

/*
 * jsdom has no layout engine, so this cannot measure where the media lands.
 * What it can pin down is the mechanism of the bug: the absolutely positioned
 * media box inherited the post's line-height, and an inline-level child inside
 * it was dropped onto the text baseline, painting the emoji a whole line below
 * the glyph it stands in for.
 */
it('holds the media in a block-level box, not on the text baseline', () => {
  const screen = render()

  const media = screen.container.querySelector('[data-testid="media"]')
  const box = media?.parentElement
  if (!box) throw new Error('media was not wrapped')

  expect(box.style.position).toBe('absolute')
  expect(box.style.display).toBe('flex')

  screen.unmount()
})
