import { Adapt, Button, Dialog, type DialogProps, Sheet, Unspaced } from 'tamagui'
import { X } from '@tamagui/lucide-icons'
import type { JSX } from 'react'

const FullDialog: React.FC<
  DialogProps & {
    trigger: string | JSX.Element
    title: string | JSX.Element
    description: string | JSX.Element
    isOpen?: boolean
    setOpen?: (open: boolean) => void
  }
> = ({ children, title, trigger, description, isOpen, setOpen }) => {
  return (
    <Dialog modal open={isOpen}>
      <Dialog.Trigger asChild>
        <Button {...(setOpen && { onPress: () => setOpen(true) })}>{trigger}</Button>
      </Dialog.Trigger>
      <Adapt when="sm" platform="touch">
        <Sheet animation="quick" zIndex={200000} modal dismissOnSnapToBottom>
          <Sheet.Frame padding="$4" gap="$4">
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        </Sheet>
      </Adapt>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="lazy"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
        >
          <Unspaced>
            <Dialog.Close displayWhenAdapted asChild>
              <Button
                position="absolute"
                top="$3"
                right="$3"
                size="$2"
                circular
                icon={X}
                {...(setOpen && { onPress: () => setOpen(false) })}
              />
            </Dialog.Close>
          </Unspaced>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

export { FullDialog }
