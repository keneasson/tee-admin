import { X } from '@tamagui/lucide-icons'
import type { BackendLists } from 'app/types'
import { Button, CheckboxWithCheck, Dialog, Form, FormInput, Unspaced, XStack } from '@my/ui'
import { SubmitHandler, useForm } from 'react-hook-form'
import { addContactsList } from '../../../provider/get-data'

export type AddUpdateListParams = {
  list?: BackendLists
}

type AddUpdateUserType = {
  displayName: string
  listName: string
  defaultOptIn: boolean
}

export const AddUpdateList: React.FC<AddUpdateListParams> = ({ list }) => {
  const sesListForm: BackendLists = {
    displayName: '',
    listName: '',
    defaultOptIn: false,
  }

  const onSubmit: SubmitHandler<AddUpdateUserType> = (data) => {
    const result = addContactsList({
      listName: data.listName,
      displayName: data.displayName,
      defaultOptIn: data.defaultOptIn,
    })
    console.log('form was submitted', { data, result })
  }

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddUpdateUserType>()
  return (
    <>
      <Unspaced>
        <Dialog.Close displayWhenAdapted asChild>
          <Button position="absolute" top="$3" right="$3" size="$2" circular icon={X} />
        </Dialog.Close>
      </Unspaced>
      <Dialog.Title>Add New Subscriber List</Dialog.Title>

      <Dialog.Description>Add a Subscriber List for sending bulk emails.</Dialog.Description>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          control={control}
          {...register('listName', { required: true })}
          label="List Name"
        />
        <FormInput
          control={control}
          {...register('displayName', { required: true })}
          label="Display Name"
        />
        <CheckboxWithCheck control={control} name={'defaultOptIn'} label="Auto Opt In" />
        <XStack alignSelf="flex-end" gap="$4">
          <Form.Trigger asChild>
            <Button theme="active" aria-label="Save">
              Save changes
            </Button>
          </Form.Trigger>
        </XStack>
      </Form>
    </>
  )
}
