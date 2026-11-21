import {useLayoutEffect} from 'react'

import {type Theme} from '#/alf'

/**
 * CSS custom properties the Terrazzo picker and its tiles read.
 *
 * The package ships its own palette (`@terrazzo/tokens`), which follows the OS
 * color scheme rather than the ALF theme, and several semantic variables it
 * references (`--tz-color-control-bg`, `--tz-text-primary`, ...) are never
 * defined by it at all. Mapping them from the active theme is what makes the
 * picker look like part of the app.
 *
 * They are written to the document element instead of a wrapper because the
 * picker's color-space dropdown portals to `document.body`, outside the
 * dialog's subtree. Values are restored on unmount, so a theme switch while
 * closed leaves no trace.
 */
export function terrazzoThemeVars(theme: Theme): Record<string, string> {
  const {atoms, palette} = theme
  return {
    // Surfaces and syntax colors the picker renders directly.
    '--tz-color-base': atoms.bg.backgroundColor,
    '--tz-color-bg-1': atoms.bg.backgroundColor,
    '--tz-color-bg-2': atoms.bg_contrast_100.backgroundColor,
    '--tz-color-bg-3': atoms.bg_contrast_200.backgroundColor,
    '--tz-color-text-1': atoms.text.color,
    '--tz-color-text-2': atoms.text_contrast_medium.color,
    '--tz-color-text-3': atoms.text_contrast_low.color,
    '--tz-color-border-1': atoms.border_contrast_low.borderColor,
    '--tz-color-border-2': atoms.border_contrast_medium.borderColor,
    '--tz-color-border-3': atoms.border_contrast_high.borderColor,
    '--tz-color-border-focus': palette.primary_500,
    '--tz-text-primary': atoms.text.color,
    '--tz-text-secondary': atoms.text_contrast_medium.color,
    '--tz-text-link-primary': atoms.text_link.color,
    '--tz-button-secondary-border': atoms.border_contrast_medium.borderColor,
    '--tz-icon-secondary': atoms.text_contrast_medium.color,

    // The hex box under the sliders.
    '--tz-color-picker-input': atoms.text.color,
    '--tz-color-picker-input-bg': atoms.bg_contrast_25.backgroundColor,
    '--tz-color-picker-input-border': atoms.border_contrast_medium.borderColor,
    '--tz-color-picker-input-text': atoms.text.color,

    // Color-space select (tiles): trigger and highlighted option.
    '--tz-color-control-bg': atoms.bg_contrast_100.backgroundColor,
    '--tz-color-control-border-focus': palette.primary_500,
    '--tz-color-base-gray-1100': atoms.text.color,
    '--tz-color-base-lime-200': atoms.text_inverted.color,
    '--tz-color-base-lime-500': palette.primary_500,
    '--tz-color-base-lime-600': palette.primary_500,
    '--tz-nav-primary-highlight': palette.primary_500,

    // Alpha checkerboard and the tooltip chevron in the swatch corners.
    '--tz-color-base-gray-800': palette.contrast_500,
    '--tz-color-base-gray-900': palette.contrast_700,

    // Gaps the published stylesheets read but never define.
    '--tz-color-channel-slider-track-height': '1.5rem',
    '--tz-radius-1': '4px',
    '--tz-radius-2': '8px',
    '--tz-font-body-family': 'inherit',
    '--tz-font-label-small-font-style': 'normal',
  }
}

/** Applies the picker's custom properties for as long as `theme` is active. */
export function useTerrazzoTheme(theme: Theme) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const vars = terrazzoThemeVars(theme)
    const previous = Object.keys(vars).map(
      key =>
        [
          key,
          root.style.getPropertyValue(key),
          root.style.getPropertyPriority(key),
        ] as const,
    )
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
    return () => {
      for (const [key, value, priority] of previous) {
        if (value) root.style.setProperty(key, value, priority)
        else root.style.removeProperty(key)
      }
    }
  }, [theme])
}
