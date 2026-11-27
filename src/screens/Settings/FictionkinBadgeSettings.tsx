import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {
  useHideOwnFictionkinBadge,
  useSetHideOwnFictionkinBadge,
} from '#/state/preferences/hide-own-fictionkin-badge'
import {RQKEY_ROOT as POST_FEED_RQKEY_ROOT} from '#/state/queries/post-feed'
import {
  useProfileQuery,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {postThreadQueryKeyRoot} from '#/state/queries/usePostThread/types'
import {useSession} from '#/state/session'
import {atoms as a, platform, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {applyFictionkinLabel} from '#/components/fictionkinApplyLabel'
import {FictionkinBadge} from '#/components/FictionkinBadge'
import {
  deltaLabelValue,
  getDeltaLabel,
  isDeltaLabelValue,
  KIN_CHARACTER_NAMES,
  KIN_CHARACTERS,
  KIN_TYPES,
  type KinCharacter,
  type KinType,
} from '#/components/fictionkinLabels'
import * as Toggle from '#/components/forms/Toggle'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'FictionkinBadgeSettings'
>

const KIN_LABELS: Record<KinType, MessageDescriptor> = {
  badge: msg`Just the badge`,
  s: msg`Literal`,
  fictive: msg`Fictive`,
  fictionkin: msg`Fictionkin`,
  otherkin: msg`Otherkin`,
}

export function FictionkinBadgeSettingsScreen({}: Props) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const updateProfile = useProfileUpdateMutation()
  const hideOwnBadge = useHideOwnFictionkinBadge()
  const setHideOwnBadge = useSetHideOwnFictionkinBadge()

  const saved = profile ? getDeltaLabel(profile) : undefined

  const [enabled, setEnabled] = useState(!!saved)
  const [character, setCharacter] = useState<KinCharacter>(
    saved?.character ?? 'kris',
  )
  const [kin, setKin] = useState<KinType>(saved?.kin ?? 's')
  const [savedOnce, setSavedOnce] = useState(false)

  /*
   * The profile arrives after mount, so adopt whatever label is already there
   * instead of showing a stale default. Only until the user edits, otherwise a
   * background refetch would discard their changes.
   */
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (touched || !profile) return
    setEnabled(!!saved)
    if (saved) {
      setCharacter(saved.character)
      setKin(saved.kin)
    }
  }, [profile, saved, touched])

  const dirty =
    enabled !== !!saved ||
    (enabled && (character !== saved?.character || kin !== saved?.kin))

  const canSave = !!profile && !updateProfile.isPending && (dirty || !saved)

  const onSave = () => {
    if (!profile) return
    setSavedOnce(false)

    const newValue = enabled ? deltaLabelValue(character, kin) : undefined

    updateProfile.mutate(
      {
        profile,
        updates: existing => {
          const {labels} = applyFictionkinLabel(
            existing,
            enabled ? {character, kin} : undefined,
          )
          if (labels) existing.labels = labels
          else delete existing.labels
          return existing
        },
        checkCommitted: res => {
          const hasOwn = (val: string) =>
            !!res?.labels?.some(
              label => label.val === val && label.src === res.did,
            )
          if (newValue) return hasOwn(newValue)
          return !res?.labels?.some(
            label => isDeltaLabelValue(label.val) && label.src === res.did,
          )
        },
      },
      {
        onSuccess() {
          setTouched(false)
          setSavedOnce(true)
          // refetch only the first page of each feed
          void queryClient.resetQueries({
            queryKey: [POST_FEED_RQKEY_ROOT],
          })
          void queryClient.invalidateQueries({
            queryKey: [postThreadQueryKeyRoot],
          })
        },
      },
    )
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Fictionkin badge</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_xl, a.gap_xl]}>
          {profile && (
            <View
              style={[
                a.flex_row,
                a.justify_center,
                a.align_center,
                a.gap_sm,
                a.rounded_lg,
                a.border,
                t.atoms.bg_contrast_50,
                t.atoms.border_contrast_low,
                {height: 160, paddingRight: 20},
              ]}>
              <View>
                <View style={[a.flex_row, a.align_center, a.gap_xs]}>
                  <Text
                    emoji
                    style={[
                      a.text_xl,
                      a.font_semi_bold,
                      a.flex_shrink,
                      a.leading_tight,
                    ]}
                    numberOfLines={1}>
                    {profile.displayName || profile.handle}
                  </Text>
                  {enabled && (
                    <View style={{top: platform({ios: -1})}}>
                      <FictionkinBadge character={character} width={17} />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    a.text_md,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}
                  numberOfLines={1}>
                  @{profile.handle}
                </Text>
              </View>
            </View>
          )}

          <View style={[a.gap_sm]}>
            <Text style={[a.text_2xl, a.font_bold]}>
              <Trans>Show a character badge</Trans>
            </Text>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                Adds a small character badge next to your name. The badge is
                stored as a self-label on your profile, so it can be removed at
                any time.
              </Trans>
            </Text>
          </View>

          <Admonition type="tip">
            <View style={[a.gap_2xs]}>
              <Text>
                <Trans>Here’s a short guide to the kin options:</Trans>
              </Text>
              <Text>
                <Trans>– Fictive: you identify as the character.</Trans>
              </Text>
              <Text>
                <Trans>
                  – Fictionkin: you identify as the character on a more personal
                  level.
                </Trans>
              </Text>
              <Text>
                <Trans>– Otherkin: therian, but for fictional species.</Trans>
              </Text>
              <Text style={[a.mt_sm]}>
                <Trans>
                  These descriptions are a starting point; people use these
                  terms differently.
                </Trans>
              </Text>
            </View>
          </Admonition>

          <Toggle.Item
            testID="fictionkinBadgeToggle"
            name="fictionkin_badge"
            disabled={!profile || updateProfile.isPending}
            value={enabled}
            onChange={value => {
              setTouched(true)
              setEnabled(value)
              setSavedOnce(false)
            }}
            label={l`Show character badge`}
            style={[
              a.w_full,
              a.p_md,
              a.rounded_lg,
              a.border,
              t.atoms.border_contrast_low,
              t.atoms.bg_contrast_50,
            ]}>
            <View style={[a.pr_xs]}>
              <FictionkinBadge character={character} width={24} />
            </View>
            <Toggle.LabelText style={[a.flex_1, a.text_md, a.font_medium]}>
              <Trans>Show character badge</Trans>
            </Toggle.LabelText>
            <Toggle.Platform />
          </Toggle.Item>

          {enabled && (
            <>
              <View
                style={[
                  a.w_full,
                  a.p_md,
                  a.rounded_lg,
                  a.border,
                  t.atoms.border_contrast_low,
                  t.atoms.bg_contrast_50,
                  a.gap_sm,
                ]}>
                <Text
                  style={[
                    a.text_sm,
                    a.font_medium,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>Character</Trans>
                </Text>
                <Toggle.Group
                  type="radio"
                  values={[character]}
                  onChange={values => {
                    const next = values[0] as KinCharacter | undefined
                    if (!next) return
                    setTouched(true)
                    setCharacter(next)
                    setSavedOnce(false)
                  }}
                  label={l`Character`}>
                  <View style={[a.gap_sm, a.pt_xs]}>
                    {KIN_CHARACTERS.map(value => (
                      <Toggle.Item
                        key={value}
                        name={value}
                        label={KIN_CHARACTER_NAMES[value]}>
                        <Toggle.RadioWithLabel
                          label={KIN_CHARACTER_NAMES[value]}
                          selected={character === value}
                        />
                      </Toggle.Item>
                    ))}
                  </View>
                </Toggle.Group>
              </View>

              <View
                style={[
                  a.w_full,
                  a.p_md,
                  a.rounded_lg,
                  a.border,
                  t.atoms.border_contrast_low,
                  t.atoms.bg_contrast_50,
                  a.gap_sm,
                ]}>
                <Text
                  style={[
                    a.text_sm,
                    a.font_medium,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>Kin</Trans>
                </Text>
                <Toggle.Group
                  type="radio"
                  values={[kin]}
                  onChange={values => {
                    const next = values[0] as KinType | undefined
                    if (!next) return
                    setTouched(true)
                    setKin(next)
                    setSavedOnce(false)
                  }}
                  label={l`Kin type`}>
                  <View style={[a.gap_sm, a.pt_xs]}>
                    {KIN_TYPES.map(value => {
                      const label = i18n._(KIN_LABELS[value])
                      return (
                        <Toggle.Item key={value} name={value} label={label}>
                          <Toggle.RadioWithLabel
                            label={label}
                            selected={kin === value}
                          />
                        </Toggle.Item>
                      )
                    })}
                  </View>
                </Toggle.Group>
              </View>

              <Toggle.Item
                name="hide_own_fictionkin_badge"
                value={hideOwnBadge}
                onChange={value => setHideOwnBadge(value)}
                label={l`Hide my badge from myself`}
                style={[
                  a.w_full,
                  a.p_md,
                  a.rounded_lg,
                  a.border,
                  t.atoms.border_contrast_low,
                  t.atoms.bg_contrast_50,
                ]}>
                <Toggle.LabelText style={[a.flex_1, a.text_md, a.font_medium]}>
                  <Trans>Hide my badge from myself</Trans>
                </Toggle.LabelText>
                <Toggle.Platform />
              </Toggle.Item>
            </>
          )}

          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <Button
              testID="saveFictionkinBadge"
              label={l`Save changes`}
              onPress={onSave}
              color="primary"
              size="large"
              disabled={!canSave}>
              <ButtonText>
                {updateProfile.isPending ? (
                  <Trans>Saving…</Trans>
                ) : (
                  <Trans>Save changes</Trans>
                )}
              </ButtonText>
            </Button>
            {savedOnce && !dirty && (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Saved</Trans>
              </Text>
            )}
          </View>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}
