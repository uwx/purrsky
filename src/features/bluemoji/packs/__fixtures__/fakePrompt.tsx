import {useState} from 'react'
import {Pressable, Text, View} from 'react-native'

/**
 * A stand-in for `#/components/Prompt` in tests.
 *
 * The real prompt renders through the dialog stack, which needs the bottom sheet
 * and safe-area providers. These keep the same controls and visibility rules so
 * the flow a caller builds is what gets tested.
 */

export type Control = {
  id: string
  ref: {current: null}
  isOpen: boolean
  open: () => void
  close: () => void
}

export function usePromptControl(): Control {
  const [isOpen, setIsOpen] = useState(false)
  return {
    id: 'prompt',
    ref: {current: null},
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}

export function Outer({
  control,
  children,
}: {
  control: Control
  children: React.ReactNode
}) {
  return control.isOpen ? <View>{children}</View> : null
}

export function Content({children}: {children: React.ReactNode}) {
  return <View>{children}</View>
}

export function TitleText({children}: {children: React.ReactNode}) {
  return <Text>{children}</Text>
}

export function DescriptionText({children}: {children: React.ReactNode}) {
  return <Text>{children}</Text>
}

export function Actions({children}: {children: React.ReactNode}) {
  return <View>{children}</View>
}

export function Cancel() {
  return null
}

export function Action({
  cta,
  onPress,
}: {
  cta?: string
  onPress: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <Pressable
      accessibilityLabel={cta}
      accessibilityHint={undefined}
      onPress={onPress}
    />
  )
}

export function Basic({
  control,
  title,
  confirmButtonCta,
  onConfirm,
}: {
  control: Control
  title: string
  description?: string
  cancelButtonCta?: string
  confirmButtonCta?: string
  onConfirm: () => void
}) {
  return control.isOpen ? (
    <View>
      <Text>{title}</Text>
      <Pressable
        accessibilityLabel={confirmButtonCta}
        accessibilityHint={undefined}
        onPress={onConfirm}
      />
    </View>
  ) : null
}
