import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {BluemojiImage} from '#/features/bluemoji/BluemojiImage'
import {getLicenseUrl, getSafeSourceUrl} from '#/features/bluemoji/provenance'
import {type BluemojiItem} from '#/features/bluemoji/util'

/**
 * The body of the emoji details popup, shared by the native sheet and the web
 * tooltip so they cannot drift apart. `source` and `license` are self-asserted
 * provenance, so they only render as links when they parse as one.
 *
 * It picks its own preview from the item: a rendition is not necessarily
 * available here, since a call site may show a different one or none at all.
 */
export function BluemojiDetails({
  item,
  alt,
}: {
  item: BluemojiItem
  alt: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const source = getSafeSourceUrl(item.record.source)
  const license = item.record.license?.trim()
  const licenseUrl = getLicenseUrl(license)

  return (
    <View style={[a.flex_row, a.align_start, a.gap_md]}>
      <BluemojiImage item={item} size={48} label={alt} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji style={[a.font_bold, a.text_md]}>
          {item.record.name}
        </Text>
        {alt !== item.record.name ? (
          <Text emoji style={[a.text_sm, a.leading_snug]}>
            {alt}
          </Text>
        ) : null}
        {source ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Source:</Trans>{' '}
            <InlineLinkText
              to={source}
              label={l`Open the original artwork`}
              style={[a.text_sm]}>
              {source.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </InlineLinkText>
          </Text>
        ) : null}
        {license ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>License:</Trans>{' '}
            {licenseUrl ? (
              <InlineLinkText
                to={licenseUrl}
                label={l`Read the license terms`}
                style={[a.text_sm]}>
                {license}
              </InlineLinkText>
            ) : (
              license
            )}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
