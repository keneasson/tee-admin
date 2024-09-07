import React, { useId } from 'react'
import type { InputProps } from 'tamagui'
import { Input, Label, XStack, YStack } from 'tamagui'
import { type Control, Controller, FieldValues, Path } from 'react-hook-form'
import { FormFieldset } from './form-fieldset'

type FormInputProps<T extends FieldValues> = Omit<InputProps, 'name'> & {
  control: Control<T, object>
  label?: string
  rules?: object
  name: Path<T>
}

export const FormInput = <T extends FieldValues>({
  control,
  rules,
  name,
  label,
}: FormInputProps<T>) => {
  const id = useId()

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
        <FormFieldset>
          <YStack>
            <XStack>
              {label && <Label htmlFor={id}>{label}</Label>}
              <Input ref={ref} id={id} value={value} onChangeText={onChange} />
            </XStack>
            {/*{errors[name] && <Text>{errors[name]}</Text>}*/}
          </YStack>
        </FormFieldset>
      )}
    />
  )
}
