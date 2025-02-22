import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { User } from 'next-auth'
import { generateUpdateExpression } from '@auth/dynamodb-adapter'

import { getAwsDbConfig } from '../email/sesClient'
import { nextAuthDynamoDb } from '../auth'

import { DirectoryType } from '@my/app/types'

type EmailUserProps = {
  email: string
}

const dbClientConfig = getAwsDbConfig()

type DBUser = User & {
  pkey: string
  skey: string
  gsi1sk: string
  gsi1pk: string
  image: string
  id: string
}

async function addUsersRoleToDB({ user, legacy }: { user: DBUser; legacy: DirectoryType }) {
  console.log('set-user-role addUsersRoleToDB', user)
  if (!user?.id) return
  const { pkey, skey } = user
  try {
    const dbClient = new DynamoDBClient(dbClientConfig)
    const docClient = DynamoDBDocumentClient.from(dbClient)
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      generateUpdateExpression({
        role: user.role,
        ecclesia: legacy.ecclesia.trim(),
        profile: {
          fname: legacy.FirstName.trim(),
          lname: legacy.LastName.trim(),
          phone: legacy.Phone.trim(),
          address: legacy.Address.trim(),
          children: legacy.Children.trim(),
        },
      })

    const update: UpdateCommandInput = {
      TableName: nextAuthDynamoDb.tableName,
      Key: {
        pkey: `USER#${user.id}`,
        skey: `USER#${user.id}`,
      },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }

    const updateCmd = new UpdateCommand(update)
    const ret = await docClient.send(updateCmd)
    console.log('addUsersRoleToDB ret', { update, ret })
    return ret
  } catch (err) {
    console.log('failed to addUserRoleToDB ', err)
    return
  }
}

export { addUsersRoleToDB }
