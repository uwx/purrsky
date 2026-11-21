import type * as ColorJsModule from 'colorjs.io/fn'

type ColorJs = typeof ColorJsModule

/*
 * Reproduces the ordering the web bundle actually has. `colorjs.io/fn`
 * registers nothing, and `@terrazzo/token-tools` is what fills the registry -
 * through a binding import that Metro defers until first use. `useColor()` calls
 * `getColor()` before it ever touches that binding, so the picker used to parse
 * its opening color against an empty registry and throw
 * "can't access property \"space\", format is null" on mount.
 *
 * Both modules are loaded inside `isolateModules` because the registry is
 * module state: sharing the test's copy of `colorjs.io/fn` would hide the very
 * mismatch under test.
 */
function loadWithRegistration() {
  let colorjs!: ColorJs
  jest.isolateModules(() => {
    colorjs = require('colorjs.io/fn')
    expect(Object.keys(colorjs.ColorSpace.registry)).toHaveLength(0)
    require('./colorSpaces')
  })
  return colorjs
}

describe('colorSpaces', () => {
  it('makes the colors the picker parses resolvable', () => {
    const colorjs = loadWithRegistration()

    expect(colorjs.getColor('oklch(0.24619 0.039848 249.73)').space.id).toBe(
      'oklch',
    )
    expect(colorjs.getColor('oklch(0.7 0.2 150)').space.id).toBe('oklch')
    expect(colorjs.getColor('#112233').space.id).toBe('srgb')
  })

  /*
   * `@terrazzo/use-color` registers HSV/Okhsl/Okhsv itself on import, so
   * whichever module evaluates second must not collide with the other's
   * entries. `ColorSpace.register` throws on a duplicate id.
   */
  it('tolerates the picker having registered its own spaces first', () => {
    let colorjs!: ColorJs
    jest.isolateModules(() => {
      colorjs = require('colorjs.io/fn')
      for (const space of [colorjs.HSV, colorjs.Okhsl, colorjs.Okhsv]) {
        colorjs.ColorSpace.register(space)
      }

      expect(() => require('./colorSpaces')).not.toThrow()
    })

    expect(colorjs.getColor('oklch(0.5 0.1 200)').space.id).toBe('oklch')
    expect(colorjs.getColor('color(--hsv 210 66% 20%)').space.id).toBe('hsv')
  })
})
