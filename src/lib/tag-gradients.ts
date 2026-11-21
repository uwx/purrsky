import {chroma} from '#/platform/chroma-formats'

/**
 * Wafrn's hashtag gradients.
 *
 * Ported from wafrn's `tag-gradients.scss`. Flags and joke tags paint the tag
 * text itself instead of the theme link color. Stops are clamped per scheme:
 * flags contain black and white stripes that would otherwise vanish into the
 * page background, so achromatic stops become a fixed gray and colorful stops
 * a fixed lightness, keeping hue and chroma.
 *
 * Later entries win, mirroring the stylesheet's cascade (wafrn declares
 * `aromantic` twice; the second block is the one that paints).
 */
export type TagGradient = {
  /** Tag spellings that select this gradient, matched case-insensitively. */
  tags: string[]
  /** Raw stops, as written in the stylesheet. */
  colors: string[]
}

export const TAG_GRADIENTS: TagGradient[] = [
  {
    tags: ['lgbt', 'lgbtq', 'lgbtqia', 'pride'],
    colors: ['#e50000', '#ff8d00', '#ffee00', '#028121', '#004cff', '#770088'],
  },
  {
    tags: ['queer'],
    colors: ['#99d9ea', '#00a2e8', '#b5e61d', '#ffc89e', '#fd6666', '#ffaec9'],
  },
  {
    tags: ['transgender', 'transgenderdayofvisibility', 'trans'],
    colors: ['#5bcefa', '#f5a9b8', '#fff', '#f5a9b8', '#5bcefa'],
  },
  {
    tags: ['transfeminine', 'transfem'],
    colors: ['#73deff', '#ffe0ed', '#ff8cbe', '#ffe0ed', '#73deff'],
  },
  {
    tags: ['transmasculine', 'transmasc'],
    colors: ['#ff8abd', '#cdf5fe', '#74dfff', '#cdf5fe', '#ff8abd'],
  },
  {
    tags: ['genderfluid'],
    colors: ['#ff76a2', '#fff', '#bf12d8', '#000', '#303cbe'],
  },
  {
    tags: ['bisexual', 'bi'],
    colors: ['#d60270', '#9b4f96', '#0038a8'],
  },
  {
    tags: ['nonbinary', 'enby', 'nb'],
    colors: ['#fff430', '#fff', '#9c59d1', '#000'],
  },
  {
    tags: ['genderqueer'],
    colors: ['#b57edc', '#fff', '#4a8123'],
  },
  {
    tags: ['asexual', 'ace'],
    colors: ['#000', '#aaa', '#810081'],
  },
  {
    tags: ['gay', 'mlm'],
    colors: ['#26ceaa', '#f1efff', '#5049cc'],
  },
  {
    tags: ['achillean'],
    colors: ['#99c6ea', '#f9fdea', '#99c6ea'],
  },
  {
    tags: ['lesbian', 'wlw'],
    colors: ['#d62900', '#ff9b55', '#d461a6', '#a50062'],
  },
  {
    tags: ['sapphic'],
    colors: ['#fd8ba8', '#fbf2ff', '#fd8ba8'],
  },
  {
    tags: ['intersex'],
    colors: ['#ffda00', '#7a00ac'],
  },
  {
    tags: ['pansexual', 'pan'],
    colors: ['#ff1b8d', '#ffda00', '#1bb3ff'],
  },
  {
    tags: ['aromantic', 'aro'],
    colors: ['#3aa63f', '#a8d47a', '#aaa', '#000'],
  },
  {
    tags: ['agender'],
    colors: ['#000', '#aaa', '#b6f583', '#aaa', '#000'],
  },
  {
    tags: ['bigender'],
    colors: [
      '#6992d9',
      '#90c3e8',
      '#aaa',
      '#c4a4ea',
      '#aaa',
      '#90c3e8',
      '#6992d9',
    ],
  },
  {
    tags: ['aroace'],
    colors: ['#000', '#810081', '#aaa', '#fff', '#a8d47a', '#3aa63f'],
  },
  {
    tags: ['aromantic'],
    colors: ['#3da542', '#a7d379', '#fff', '#a9a9a9', '#000'],
  },
  {
    tags: ['demisexual'],
    colors: ['#fff', '#7c0070', '#aaa'],
  },
  {
    tags: ['demiromantic'],
    colors: ['#fff', '#339933', '#aaa'],
  },
  {
    tags: ['plural'],
    colors: ['#34052a', '#6f4884', '#8484c6', '#94c3b1', '#f3ecbd'],
  },
  {
    tags: ['voidpunk'],
    colors: ['#362d49', '#9f74b7', '#e9e9e9', '#51ad55', '#20442d'],
  },
  {
    tags: [
      'autism',
      'autistic',
      'auctober',
      'actually autistic',
      'autism acceptance',
      'autismacceptance',
      'autismawareness',
      'autism awareness',
      'actuallyautistic',
      'redinstead',
      'red instead',
    ],
    colors: ['#e43345', '#f68249', '#fac758', '#98d570', '#26ac74'],
  },
  {
    tags: [
      'adhd',
      'attention deficit hyperactivity disorder',
      'attentiondeficithyperactivitydisorder',
    ],
    colors: ['#520100', '#fec262', '#ff7c52', '#ce3c3c', '#8c002d'],
  },
  {
    tags: ['audhd', 'autiadhd'],
    colors: ['#50000d', '#b32d2c', '#e6805a', '#fcedcc', '#80a1a8'],
  },
  {
    tags: ['voidtoonballoon'],
    colors: ['#cc649c', '#3e4046', '#e9e839', '#ad89be', '#f91dfb', '#421e53'],
  },
  {
    tags: ['italian'],
    colors: ['#009344', '#fff', '#cf2734'],
  },
  {
    tags: ['lebanese'],
    colors: ['#ce1126', '#fff', '#ce1126'],
  },
  {
    tags: ['tax fraud', 'taxfraud', 'tax evasion', 'taxevasion'],
    colors: ['#7d9d6c', '#5f5f5f', '#681a09', '#5f5f5f', '#7d9d6c'],
  },
  {
    tags: ['heterosexual'],
    colors: [
      'rgba(1, 1, 1, 0.25)',
      'rgba(1, 1, 1, 0.5)',
      'rgba(1, 1, 1, 0.25)',
    ],
  },
  {
    tags: ['beti', 'betis'],
    colors: ['#0bb363', '#fff', '#0bb363', '#fff'],
  },
  {
    tags: ['unemployed', 'greek'],
    colors: ['#0d5eaf', '#fff', '#0d5eaf', '#fff'],
  },
  {
    tags: ['bottom'],
    colors: ['#fff', '#dc143c'],
  },
  {
    tags: ['top'],
    colors: ['#c8102e', '#fff', '#003da5'],
  },
  {
    tags: ['cheese'],
    colors: ['yellow', 'orange', 'yellow'],
  },
  {
    tags: ['eepy'],
    colors: ['red', 'red', 'red', 'yellow', 'red', 'red', 'red'],
  },
  {
    tags: ['neptunic'],
    colors: ['#2596be', '#3ad5c8', '#74e9d4', '#a1e6ef', '#99b0ea', '#8083e2'],
  },
  {
    tags: ['lunaric'],
    colors: ['#854faa', '#aa7ec8', '#cdb5de', '#f9f0ff', '#fffbe3', '#fff5bc'],
  },
]

const GRADIENTS_BY_TAG = new Map<string, TagGradient>()
for (const gradient of TAG_GRADIENTS) {
  for (const tag of gradient.tags) {
    GRADIENTS_BY_TAG.set(tag, gradient)
  }
}

/** LCH lightness targets, as percentages, from wafrn's `clamp-colors`. */
type LightnessTargets = {
  /** Achromatic stops that started near black. */
  darker: number
  /** Achromatic stops that started light. */
  lighter: number
  /** Every colorful stop. */
  medium: number
}

const LIGHT_TARGETS: LightnessTargets = {darker: 34, lighter: 62, medium: 45}
const DARK_TARGETS: LightnessTargets = {darker: 48, lighter: 78, medium: 60}

/** HSL saturation, in percent, below which a stop counts as achromatic. */
const ACHROMATIC_SATURATION = 5
/** HSL lightness, in percent, below which an achromatic stop counts as black. */
const NEAR_BLACK_LIGHTNESS = 5

const resolved = new Map<string, {colors: string[]}>()

/**
 * Gradient for a tag, or undefined when the tag has none. Colors are already
 * clamped for `scheme`, and the result is cached because feed rows ask for the
 * same handful of tags over and over.
 */
export function getTagGradient(
  tag: string,
  scheme: 'light' | 'dark',
): {colors: string[]} | undefined {
  const name = tag.trim().toLowerCase()
  const gradient = GRADIENTS_BY_TAG.get(name)
  if (!gradient) return undefined
  /* Only known tags are cached, so the cache stays bounded by the table. */
  const key = `${scheme}:${name}`
  let value = resolved.get(key)
  if (!value) {
    value = {colors: clampColors(gradient.colors, scheme === 'dark')}
    resolved.set(key, value)
  }
  return value
}

/**
 * Wafrn's `clamp-colors`, in LCH.
 *
 * Stops come out as opaque six-digit hex: the tag renderers (OKLCH sampling on
 * web, per-grapheme sampling on native) only parse that form. A translucent
 * stop, like the `heterosexual` joke flag, is composited over the scheme's
 * page color, which keeps the flag's faint look instead of dropping it.
 */
function clampColors(colors: string[], dark: boolean): string[] {
  const targets = dark ? DARK_TARGETS : LIGHT_TARGETS
  const page = chroma(dark ? '#000' : '#fff').rgb()
  return colors.map(color => {
    const stop = chroma(color)
    const saturation = stop.get('hsl.s') * 100
    const lightness = stop.get('hsl.l') * 100
    const clamped =
      saturation < ACHROMATIC_SATURATION
        ? stop
            .set('lch.c', 0)
            .set(
              'lch.l',
              lightness < NEAR_BLACK_LIGHTNESS
                ? targets.darker
                : targets.lighter,
            )
        : stop.set('lch.l', targets.medium)
    const alpha = clamped.alpha()
    if (alpha === 1) return clamped.hex()
    const [r, g, b] = clamped.rgb()
    const over = (fore: number, back: number) =>
      Math.round(fore * alpha + back * (1 - alpha))
    return chroma([over(r, page[0]), over(g, page[1]), over(b, page[2])]).hex()
  })
}
