const {withXcodeProject} = require('expo/config-plugins')
const path = require('path')
const fs = require('fs')

/*
 * Deliberately not `AppDelegate.swift`: expo's iOS config plugins work out the
 * app's source directory by globbing `ios/AppDelegate.@(m|mm|swift)` one level
 * deep and taking the first match alphabetically. With the clip's file named
 * `AppDelegate.swift`, "BlueskyClip" sorts before "Purrsky", so plugins that
 * copy files into the app directory (expo-notifications' `sounds`) drop them
 * next to the clip while the Xcode project still references `<app>/<file>`,
 * and the build fails with a missing resource.
 */
const FILES = ['ClipAppDelegate.swift', 'ViewController.swift']

const withFiles = (config, {targetName}) => {
  return withXcodeProject(config, config => {
    const basePath = path.join(
      config.modRequest.projectRoot,
      'modules',
      targetName,
    )

    for (const file of FILES) {
      const sourcePath = path.join(basePath, file)
      const targetPath = path.join(
        config.modRequest.platformProjectRoot,
        targetName,
        file,
      )

      fs.mkdirSync(path.dirname(targetPath), {recursive: true})
      fs.copyFileSync(sourcePath, targetPath)
    }

    const imagesBasePath = path.join(basePath, 'Images.xcassets')
    const imagesTargetPath = path.join(
      config.modRequest.platformProjectRoot,
      targetName,
      'Images.xcassets',
    )
    fs.cpSync(imagesBasePath, imagesTargetPath, {recursive: true})

    return config
  })
}

module.exports = {withFiles}
