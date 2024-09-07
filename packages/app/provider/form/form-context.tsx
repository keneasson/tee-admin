import { createContext, useState } from 'react'

type errors = {
  [k: string]: string
}

type FormContextType = {
  data: unknown
  url: string
  method: 'POST' | 'PATCH' | 'PUT' | 'GET'
}

export type FormProviderProps = {
  children: React.ReactNode
  form: FormContextType
}

export const FormContext = createContext<FormContextType>({} as FormContextType)

type UseFormProps = {
  handleChange: (name, value) => boolean
  handleSubmit: () => Promise<void>
  hasErrors: boolean
  getErrorFor: (arg0: string) => string | false
  state: 'loading' | 'error' | 'ready' | 'submitting' | 'clean'
}

// Create a provider wrapper component
export const FormProvider: React.FC<FormProviderProps> = ({ children, form }) => {
  const [formData, setFormData] = useState<unknown>(form.data)
  const [url, setUrl] = useState<string>(form.url)
  const [method, setMethod] = useState<string>(form.method)

  return <FormContext.Provider value={form}>{children}</FormContext.Provider>
}

// export const useForm: UseFormProps = () => {
//   const [formData, setFormData] = useState<unknown | null>(null)
//   const [errors, setErrors] = useState<errors>({})
//   const [dirty, setDirty] = useState({})
//
//   const handleSubmit = (): void => {}
//
//   return {
//     handleSubmit,
//   }
// }
