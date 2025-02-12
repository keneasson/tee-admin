import { EmailListTypeKeys, EmailListTypes } from '@my/app/types'
import { Button, CheckboxWithCheck, Form, FormInput, FullDialog, XStack } from '@my/ui'
import { SubmitHandler, useForm } from 'react-hook-form'
import { addContacts } from '../../../provider/get-data'
import { useState } from 'react'

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
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isSending, setIsSending] = useState<boolean>(false)

  const onSubmit: SubmitHandler<AddUpdateContactType> = async (data) => {
    setIsSending(true)
    console.log('form was submitted', data)
    const newContact = await addContacts({ lists: data.lists, email: data.email })
    console.log('newContact', newContact)
    setIsSending(false)
    setIsOpen(false)
  }

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddUpdateContactType>()
  return (
    <FullDialog
      title={'Add New Contact'}
      trigger={'Add A Contact'}
      description={'Add a Contact and Select the lists they will be on.'}
      isOpen={isOpen}
      setOpen={(open: boolean) => setIsOpen(open)}
    >
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
          <Form.Trigger asChild disabled={isSending}>
            <Button theme={isSending ? 'blue_active' : 'blue'} aria-label="Save">
              Save changes
            </Button>
          </Form.Trigger>
        </XStack>
      </Form>
    </FullDialog>
  )
}
