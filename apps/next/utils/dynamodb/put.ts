import { getAwsDbConfig } from '../email/sesClient'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  type PutCommandInput,
  type PutCommandOutput,
} from '@aws-sdk/lib-dynamodb'
import { dynamoConfig } from './base'

const dbClientConfig = getAwsDbConfig()

async function put(input: PutCommandInput): Promise<PutCommandOutput> {
  const dbClient = new DynamoDBClient(dbClientConfig)
  const docClient = DynamoDBDocumentClient.from(dbClient, dynamoConfig)
  const put = new PutCommand(input)
  const ret = await docClient.send(put)
  console.log('ret', ret)
  return ret
}

export { put }
