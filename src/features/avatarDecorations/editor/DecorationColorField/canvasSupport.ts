/**
 * Whether the OKLCH picker can render here.
 *
 * Its channel gradients are WebGL2 shaders and it throws while initializing
 * them, which would unmount the settings screen. Browsers without WebGL2 (and
 * jsdom) get the browser's own picker instead.
 */
export function supportsCanvasPicker() {
  if (typeof WebGL2RenderingContext === 'undefined') return false
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}
