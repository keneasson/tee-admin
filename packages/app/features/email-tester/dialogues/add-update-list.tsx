import { Button, CheckboxWithCheck, Form, FormInput, FullDialog, Text, XStack } from '@my/ui'
import { SubmitHandler, useForm } from 'react-hook-form'
import { addContactsList } from '../../../provider/get-data'
import { BackendLists } from '../../../types'
import { useEffect, useState } from 'react'

export type AddUpdateListParams = {
  list?: BackendLists
}

type AddUpdateUserType = {
  displayName: string
  listName: string
  defaultOptIn: boolean
}

export const AddUpdateList: React.FC<AddUpdateListParams> = ({ list }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful, isSubmitting },
  } = useForm<AddUpdateUserType>()

  useEffect(() => {
    setIsOpen(false)
  }, [isSubmitSuccessful])

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

  return (
    <FullDialog
      trigger={'Create a Subscriber List'}
      title={'Add New Subscriber List'}
      description={'Add a Subscriber List for sending bulk emails.'}
      isOpen={isOpen}
      setOpen={setIsOpen}
    >
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
        {errors &&
          Object.keys(errors).map((key, index) => {
            console.log(`errors[${key}]`, errors[key])
            return (
              <XStack key={`errors-${index}`}>
                <Text>{errors[key].displayName}</Text>
              </XStack>
            )
          })}
        <XStack alignSelf="flex-end" gap="$4">
          <Form.Trigger asChild>
            <Button theme="active" aria-label="Save" disabled={isSubmitting}>
              Save changes
            </Button>
          </Form.Trigger>
        </XStack>
      </Form>
    </FullDialog>
  )
}
