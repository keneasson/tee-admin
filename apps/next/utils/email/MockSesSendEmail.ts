import { SendEmailCommandInput, SESv2Client as SESOrig } from '@aws-sdk/client-sesv2'
import { OutputType } from 'aws-sdk/clients/appsync'

export class SendEmailCommand {
  private emailInput: SendEmailCommandInput

  constructor(emailInput: SendEmailCommandInput) {
    this.emailInput = emailInput
  }
}

async function setTimeoutAsync(milliseconds: number) {
  console.log('setTimeoutAsync', { milliseconds, start: new Date().getTime() })
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('setTimeoutAsync resolve', { end: new Date().getTime(), milliseconds })
      resolve('1')
    }, milliseconds)
  })
}

class SESv2Client extends SESOrig {
  public async send(command: unknown): Promise<OutputType | unknown> {
    console.log('Faking send')
    return await setTimeoutAsync(50)
  }
}

export function getSesClient() {
  return new SESv2Client()
}
