import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {FictionkinBadge} from '#/components/FictionkinBadge'
import {
  type DeltaLabel,
  KIN_CHARACTER_NAMES,
} from '#/components/fictionkinLabels'
import {Text} from '#/components/Typography'
import {navigate} from '#/Navigation'
import type * as bsky from '#/types/bsky'

export function FictionkinBadgeAlert({
  control,
  profile,
  label,
}: {
  control: Dialog.DialogControlProps
  profile: bsky.profile.AnyProfileView
  label: DeltaLabel
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()

  const isSelf = profile.did === currentAccount?.did
  const character = KIN_CHARACTER_NAMES[label.character]

  /*
   * One whole sentence per kin type rather than a shared prefix plus a fragment,
   * so translators see a complete thought. The kin type is the claim itself:
   * "Kris" and "Kris as fictionkin" say different things.
   */
  const description = (() => {
    switch (label.kin) {
      case 'badge':
        return isSelf
          ? l`You chose to show the ${character} badge on your profile. You can change this in your settings.`
          : l`This account chose to show the ${character} badge on their profile.`
      case 's':
        return isSelf
          ? l`You identify as ${character}. You can change this in your settings.`
          : l`This account identifies as ${character}.`
      case 'fictive':
        return isSelf
          ? l`You identify as ${character} as a fictive. You can change this in your settings.`
          : l`This account identifies as ${character} as a fictive.`
      case 'fictionkin':
        return isSelf
          ? l`You identify as ${character} as fictionkin. You can change this in your settings.`
          : l`This account identifies as ${character} as fictionkin.`
      case 'otherkin':
        return isSelf
          ? l`You identify as ${character} as otherkin. You can change this in your settings.`
          : l`This account identifies as ${character} as otherkin.`
    }
  })()

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.ScrollableInner
        label={l`Fictionkin badge`}
        style={[web({maxWidth: 320})]}>
        <View style={[a.align_center, a.pb_md]}>
          <FictionkinBadge character={label.character} width={56} />
        </View>
        <View style={[a.align_center]}>
          <Text
            style={[
              a.leading_snug,
              a.text_center,
              a.pb_xl,
              a.text_md,
              t.atoms.text_contrast_high,
              {maxWidth: 300},
            ]}>
            {description}
          </Text>
        </View>
        <View style={[a.w_full, a.gap_sm]}>
          <Button
            label={l`Okay`}
            onPress={() => control.close()}
            color="primary"
            size="large">
            <ButtonText>
              <Trans>Okay</Trans>
            </ButtonText>
          </Button>
          {isSelf ? (
            <Button
              label={l`Open settings`}
              onPress={() => {
                control.close(() => {
                  void navigate({
                    name: 'FictionkinBadgeSettings',
                    params: undefined,
                  })
                })
              }}
              color="secondary"
              size="large">
              <ButtonText>
                <Trans>Open settings</Trans>
              </ButtonText>
            </Button>
          ) : null}
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
