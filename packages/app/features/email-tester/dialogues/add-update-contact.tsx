import { Button, Dialog, Fieldset, Input, Label, Unspaced, XStack } from 'tamagui'
import { X } from '@tamagui/lucide-icons'
import { EmailListTypes, SimplifiedContactsByList } from 'app/types'
import { CheckboxWithCheck } from '@my/ui'

export type AddUpdateContactParams = {
  contact: SimplifiedContactsByList
}
export const AddUpdateContact: React.FC<AddUpdateContactParams> = ({ contact }) => {
  // const email = Object.keys(newContact)[0] || '-'

  const handleSaveForm = (formData) => {
    console.log('AddUpdateList.handleOptinToggle ', { formData })
  }

  const lists = Object.keys(EmailListTypes).map((list) => list)

  return (
    <>
      <Dialog.Title>Add New Contact List</Dialog.Title>

      <Dialog.Description>Add or Update a Contact.</Dialog.Description>

      <Fieldset gap="$4" horizontal>
        <Label width={160} justifyContent="flex-end" htmlFor="email">
          Email
        </Label>
        <Input flex={1} id="email" defaultValue={email} />
      </Fieldset>
      {Object.keys(EmailListTypes).map((list) => (
        <Fieldset gap="$4" horizontal key={`key_${list}`}>
          <Label width={160} justifyContent="flex-end" htmlFor={`list.${list}`}>
            {list}
          </Label>
          <CheckboxWithCheck
            flex={1}
            id={`list.${list}`}
            name={list}
            size="$5"
            label="check to Opt-in"
          />
        </Fieldset>
      ))}

      <XStack alignSelf="flex-end" gap="$4">
        <Dialog.Close displayWhenAdapted asChild>
          <Button theme="active" aria-label="Close">
            Save changes
          </Button>
        </Dialog.Close>
      </XStack>
      <Unspaced>
        <Dialog.Close asChild>
          <Button position="absolute" top="$3" right="$3" size="$2" circular icon={X} />
        </Dialog.Close>
      </Unspaced>
    </>
  )
}
