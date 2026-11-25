/*
 * react-native-executorch ships ExecuTorch binaries built for iOS 17.0 and
 * declares that floor in its podspec, so linking it makes 17.0 the app's
 * minimum. The legacy iOS build drops it, which keeps `pod install` working at
 * the Expo SDK 58 default of 16.4 so devices that stop at iOS 16 still get a
 * build. See docs/build.md.
 *
 * `{platforms: {ios: null}}` is the autolinking way to say "not on iOS": the
 * Expo autolinker returns no config for the package, so `use_native_modules!`
 * never writes its pod into the Podfile. Android is deliberately untouched, so
 * this file can never change an Android build.
 */
module.exports = {
  dependencies:
    process.env.EXPO_PUBLIC_LEGACY_IOS === '1'
      ? {
          'react-native-executorch': {platforms: {ios: null}},
        }
      : {},
}
