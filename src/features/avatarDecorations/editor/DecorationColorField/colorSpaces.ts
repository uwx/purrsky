/**
 * Registers the CSS Module 4 color spaces the picker parses.
 *
 * `colorjs.io/fn` ships its spaces as plain classes and registers none of them,
 * so `getColor('oklch(...)')` resolves `format` to null and throws while
 * reading `format.space`. `@terrazzo/use-color` registers only the three spaces
 * it draws sliders for (HSV, Okhsl, Okhsv) and counts on the import side effect
 * in `@terrazzo/token-tools` for the rest. Metro evaluates imports lazily
 * (`inlineRequires` in `metro.config.ts`), which defers that side effect until
 * after `useColor()` has already parsed the opening color, and the settings
 * screen dies on mount. Registering here, at module scope, does not depend on
 * which import graph the bundler happens to evaluate first.
 *
 * The list matches `@terrazzo/token-tools`, which is the set the picker is
 * developed against: every space a user can type into its code box. The
 * remaining exports (CAM16, HCT, ...) are not reachable from a CSS function and
 * are left out to keep them out of the web bundle.
 */

import {
  A98RGB,
  ColorSpace,
  HSL,
  HWB,
  Lab,
  Lab_D65,
  LCH,
  OKLab,
  OKLCH,
  P3,
  ProPhoto,
  REC_2020,
  sRGB,
  sRGB_Linear,
  XYZ_D50,
  XYZ_D65,
} from 'colorjs.io/fn'

for (const space of [
  A98RGB,
  P3,
  HSL,
  HWB,
  Lab,
  Lab_D65,
  LCH,
  OKLab,
  OKLCH,
  ProPhoto,
  REC_2020,
  sRGB,
  sRGB_Linear,
  XYZ_D50,
  XYZ_D65,
]) {
  ColorSpace.register(space)
}
