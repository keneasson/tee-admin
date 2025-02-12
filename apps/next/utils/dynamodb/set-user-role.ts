import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { User } from 'next-auth'

import { getAwsDbConfig } from '../email/sesClient'
import { nextAuthDynamoDb } from '../auth'

import { DirectoryType } from '@my/app/types'

type EmailUserProps = {
  email: string
}

const dbClientConfig = getAwsDbConfig()

function createUpdateExpressions(item: { [key: string]: any }) {
  const updateExpression: string[] = []
  const expressionAttribute: { [key: string]: any } = {}
  const expressionAttributeNames: { [key: string]: any } = {}
  Object.keys(item).map((key) => {
    const placeholder = `:p${key}`
    const alias = `#a${key}`
    updateExpression.push(`${alias} = ${placeholder}`)
    expressionAttribute[placeholder] = item[key]
    expressionAttributeNames[alias] = key
  })
  return {
    updateExpression: `SET ${updateExpression.join(', ')}`,
    expressionAttribute,
    expressionAttributeNames,
  }
}

// @deprecated - not using this table - see NextAuth for correct function
async function setUserRole({ email }: EmailUserProps) {
  const dbClient = new DynamoDBClient(dbClientConfig)
  const docClient = DynamoDBDocumentClient.from(dbClient)
  const put = new PutCommand({
    Item: {
      pkey: `role:${email}`,
      skey: email,
      userdata: { fname: 'Ken', lname: 'Easson', role: 'administrator' },
    },
    TableName: 'tee-admin',
    ReturnConsumedCapacity: 'TOTAL' as const,
  })
  const ret = await docClient.send(put)
  console.log('ret', ret)
  return ret
}

export { setUserRole }

async function addUsersRoleToDB({ user, legacy }: { user: User; legacy: DirectoryType }) {
  console.log('set-user-role addUsersRoleToDB', user)
  if (!user?.id) return
  const dbClient = new DynamoDBClient(dbClientConfig)
  const docClient = DynamoDBDocumentClient.from(dbClient)
  const updateCmd = new UpdateCommand({
    TableName: nextAuthDynamoDb.tableName,
    Key: {
      pkey: `USER#${user.id}`,
    },
    ...createUpdateExpressions({ role: user.role }),
  })
  const ret = await docClient.send(updateCmd)
  console.log('addUsersRoleToDB ret', ret)
  return ret
}

export { addUsersRoleToDB }
