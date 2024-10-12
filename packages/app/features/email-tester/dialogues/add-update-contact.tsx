import { X } from '@tamagui/lucide-icons'
import { EmailListTypeKeys, EmailListTypes } from 'app/types'
import { Button, CheckboxWithCheck, Dialog, Form, FormInput, Unspaced, XStack } from '@my/ui'
import { SubmitHandler, useForm } from 'react-hook-form'
import { addContacts } from '../../../provider/get-data'

export type AddUpdateContactParams = {}

type AddUpdateContactType = {
  email: string
  firstName: string
  lastName: boolean
  lists: { [K in EmailListTypeKeys]: boolean }
}

const listNameMap: { [K in EmailListTypeKeys]: string } = {
  sundaySchool: 'Sunday School',
  memorial: 'Memorial',
  bibleClass: 'Bible Class',
  newsletter: 'Newsletter',
  testList: 'Test List',
}

export const AddUpdateContact: React.FC<AddUpdateContactParams> = () => {
  const onSubmit: SubmitHandler<AddUpdateContactType> = async (data) => {
    console.log('form was submitted', data)
    const newContact = await addContacts({ lists: data.lists, email: data.email })
    console.log('newContact', newContact)
  }

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddUpdateContactType>()
  return (
    <>
      <Unspaced>
        <Dialog.Close displayWhenAdapted asChild>
          <Button position="absolute" top="$3" right="$3" size="$2" circular icon={X} />
        </Dialog.Close>
      </Unspaced>
      <Dialog.Title>Add New Contact</Dialog.Title>

      <Dialog.Description>Add a Contact and Select the lists they will be on.</Dialog.Description>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormInput control={control} {...register('email', { required: true })} label="Email" />
        <FormInput
          control={control}
          {...register('firstName', { required: true })}
          label="First Name"
        />
        <FormInput
          control={control}
          {...register('lastName', { required: true })}
          label="Last Name"
        />
        {Object.keys(EmailListTypes).map((listType: EmailListTypes) => (
          <CheckboxWithCheck
            key={listType}
            control={control}
            name={`lists.${listType}`}
            label={listNameMap[listType]}
          />
        ))}
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
