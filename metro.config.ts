// Learn more: https://docs.expo.io/guides/customizing-metro
import path from 'node:path'

import {withNanoIcons} from 'react-native-nano-icons/metro'
import {getBundleModeMetroConfig} from 'react-native-worklets/bundleMode/index.js'
import {type CustomResolver} from '@expo/metro/metro-resolver'
import {getDefaultConfig} from '@expo/metro-config'
import {getSentryExpoConfig} from '@sentry/react-native/metro.js'

let config = getSentryExpoConfig(import.meta.dirname, {
  // TODO: confirm this doesn't break anything when we switch to metro web
  includeWebReplay: false,
  /*
   * Must stay true on Windows: @sentry/react-native decides whether to stub
   * the feedbackSync/Async wrappers with `originModulePath.includes(
   * '@sentry/browser')`, which never matches a backslash path. The wrappers
   * then call `buildFeedbackIntegration()` at module evaluation time on an
   * empty module and the web bundle throws. Keep feedback bundled instead.
   */
  includeWebFeedback: true,
  annotateReactComponents: {
    textComponentNames: ['Text', 'ButtonText'],
  },
  getDefaultConfig: (projectRoot, options) => {
    const config = getDefaultConfig(projectRoot, options)

    if (typeof process.env.RN_SRC_EXT === 'string') {
      // inject `.e2e.ts` and `.e2e.tsx` into the sourceExts when running tests)
      config.resolver.sourceExts.unshift(...process.env.RN_SRC_EXT.split(','))
    }

    config.resolver.assetExts = [...config.resolver.assetExts, 'woff2']

    /*
     * Expo sets this to null, which disables Watchman, so Metro falls back to
     * one fs.watch per directory. That watcher pins a core when a build output
     * tree is rewritten underneath it (see blockList below). Watchman is
     * installed on this machine; when it is missing Metro already degrades to
     * the same fallback on its own.
     */
    // @ts-expect-error readonly property
    config.resolver.useWatchman = true

    /*
     * Build output is not part of the app graph, but Metro crawls and watches
     * it anyway. `pnpm build-web` rewrites these trees while the dev server is
     * running; the delete/recreate churn makes Windows report mangled
     * filenames, and every failed stat in the fallback watcher scans its whole
     * directory registry. That pins Metro at 100% CPU until it is restarted.
     *
     * The optional root prefix lets one pattern cover both the absolute paths
     * used to prune directories and the project-relative paths used for
     * crawled and watched files. Anchoring to the root keeps nested `dist`
     * folders in node_modules (e.g. `hls.js/dist`) resolvable.
     */
    const projectRootPattern = projectRoot
      .split(/[\\/]/)
      .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\\\/]')
    config.resolver.blockList = [
      ...(Array.isArray(config.resolver.blockList)
        ? config.resolver.blockList
        : [config.resolver.blockList]),
      new RegExp(
        `^(?:${projectRootPattern}[\\\\/])?(?:app-build|bskyweb[\\\\/]static|dist)(?:[\\\\/]|$)`,
      ),
    ]

    if (config.resolver.resolveRequest) {
      throw Error('Update this override because it is conflicting now.')
    }

    if (process.env.BSKY_PROFILE) {
      // @ts-expect-error readonly property
      config.cacheVersion += ':PROFILE'
    }

    const resolver: CustomResolver = (context, moduleName, platform) => {
      if (
        platform === 'web' &&
        /^react-native-gesture-handler(\/|$)/.test(moduleName)
      ) {
        throw new Error(
          `react-native-gesture-handler must not be imported on web (requested from ${context.originModulePath})`,
        )
      }
      /*
       * @terrazzo/tiles (pulled in by the web color picker) imports `shiki` from
       * its Demo component to syntax-highlight code samples we never render.
       * Shiki is ~10 MB of grammars and themes, and it is ESM-only, so resolving
       * it breaks the web build. An empty module keeps the graph small.
       */
      if (platform === 'web' && /^shiki(\/|$)/.test(moduleName)) {
        return {type: 'empty'}
      }
      /*
       * @use-gesture (via @terrazzo/tiles) keeps gesture config resolvers in a
       * module-level Map, but publishes ESM and CJS builds that each own a copy
       * of it. Metro picks the ESM build for `@use-gesture/react` and for the
       * `@use-gesture/core/actions` subpath (no `exports` map there, so the
       * `module` field wins), yet the `@use-gesture/core` root has an `exports`
       * map with no `import`/`module` condition, so Metro takes its CJS
       * wrapper. `registerAction` then writes into the ESM map while
       * `Controller` reads the CJS one, and the first `useDrag` throws while
       * parsing an undefined resolver. Resolve the root against the same ESM
       * tree Metro already picked for the subpaths.
       */
      if (platform === 'web' && moduleName === '@use-gesture/core') {
        const actions = context.resolveRequest(
          context,
          '@use-gesture/core/actions',
          platform,
        )
        if (actions.type === 'sourceFile') {
          /*
           * Mirror the format Metro picked for the subpath, so the root and the
           * actions modules always share one resolver map.
           */
          const esm = actions.filePath.endsWith('.esm.js')
          return {
            type: 'sourceFile',
            filePath: path.resolve(
              path.dirname(actions.filePath),
              `../../dist/use-gesture-core.${esm ? 'esm' : 'cjs'}.js`,
            ),
          }
        }
      }
      /*
       * react-native-webview has no web implementation (its fallback renders
       * "does not support this platform"), so swap in react-native-web-webview
       * to keep external media embeds working. Mirrors the old webpack alias.
       */
      if (platform === 'web' && moduleName === 'react-native-webview') {
        return context.resolveRequest(
          context,
          'react-native-web-webview',
          platform,
        )
      }
      if (
        process.env.BSKY_PROFILE &&
        moduleName.endsWith('ReactNativeRenderer-prod')
      ) {
        return context.resolveRequest(
          context,
          moduleName.replace('-prod', '-profiling'),
          platform,
        )
      }
      return context.resolveRequest(context, moduleName, platform)
    }

    // @ts-expect-error readonly property
    config.resolver.resolveRequest = resolver

    config.transformer.getTransformOptions = () =>
      Promise.resolve({
        transform: {
          experimentalImportSupport: true,
          inlineRequires: true as false, // ??? typescript why?
        },
      })

    return config as unknown as Record<string, unknown>
  },
})

config = getBundleModeMetroConfig(config)

/*
 * The icon fonts are baked into the native binary, so a dev client built from
 * an older commit lacks the glyphs the current glyphmaps point at, and those
 * icons render blank. In development this serves the current fonts from the
 * dev server, and nano-icons registers them at runtime when the binary's font
 * doesn't match. When an SVG changes, it also rebuilds that font and its
 * glyphmap in `assets/nano-icons/`, like `pnpm icons:generate` would. It does
 * nothing in production, where the fonts must ship in the binary.
 */
config = withNanoIcons(config)

export default config
