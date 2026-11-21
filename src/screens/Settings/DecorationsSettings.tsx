import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {
  applyDraftEdit,
  type DecorationDraft,
  DecorationsEditor,
  draftFromSaved,
  isDraftDirty,
  useMyDecorationSettingsQuery,
  useSaveDecorations,
} from '#/features/avatarDecorations'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'DecorationsSettings'>

export function DecorationsSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const profile = useCurrentAccountProfile()
  const settings = useMyDecorationSettingsQuery()
  const saveDecorations = useSaveDecorations()

  const saved = settings.data ?? {}
  const [draft, setDraft] = useState<DecorationDraft>(() =>
    draftFromSaved(saved),
  )
  const dirty = isDraftDirty(draft, saved)

  function onSave() {
    saveDecorations.mutate(
      {draft, saved},
      {
        onSuccess: result => {
          setDraft(draftFromSaved(result.next))
          Toast.show(l`Saved`)
        },
        onError: () => Toast.show(l`Could not save. Try again.`),
      },
    )
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Profile decorations</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <View style={[a.px_lg, a.pb_lg]}>
            <Admonition type="tip">
              <Trans>
                Decorations are stored in your account and show up in apps that
                support them. Emoji in your display name still work.
              </Trans>
            </Admonition>
          </View>

          {settings.isLoading && <Loader />}
          {settings.isError && (
            <View style={[a.px_lg, a.pb_lg]}>
              <Button
                label={l`Try again`}
                size="small"
                color="secondary"
                onPress={() => void settings.refetch()}>
                <ButtonText>
                  <Trans>Could not load your decorations. Try again.</Trans>
                </ButtonText>
              </Button>
            </View>
          )}

          {settings.isSuccess && (
            <>
              <View style={[a.px_lg]}>
                <DecorationsEditor
                  saved={saved}
                  draft={draft}
                  onEdit={patch =>
                    setDraft(current => applyDraftEdit(current, saved, patch))
                  }
                  did={profile?.did}
                  avatar={profile?.avatar}
                  displayName={profile?.displayName}
                  handle={profile?.handle}
                  disabled={saveDecorations.isPending}
                />
              </View>

              <View style={[a.px_lg, a.py_xl]}>
                <Button
                  testID="saveDecorations"
                  label={l`Save`}
                  size="large"
                  color="primary"
                  disabled={!dirty || saveDecorations.isPending}
                  onPress={onSave}>
                  <ButtonText>
                    {saveDecorations.isPending ? (
                      <Trans>Saving…</Trans>
                    ) : (
                      <Trans>Save</Trans>
                    )}
                  </ButtonText>
                </Button>
              </View>
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
