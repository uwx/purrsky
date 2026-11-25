import {TextDecoder, TextEncoder} from 'node:util'
import {i18n} from '@lingui/core'

// jsdom drops these globals, and `#/env` and the atproto lexicons read them at
// import time.
if (!window.matchMedia) {
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder

globalThis.IS_REACT_ACT_ENVIRONMENT = true
i18n.load('en', {})
i18n.activate('en')
