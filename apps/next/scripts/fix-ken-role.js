// Script to fix Ken's role in DynamoDB
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// Use the same config as the app
const dbClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const tableName = process.env.DYNAMODB_TABLE_NAME || 'tee-admin';
const email = process.env.TARGET_EMAIL || 'ken.easson@gmail.com';

async function fixKenRole() {
  const dbClient = new DynamoDBClient(dbClientConfig);
  const docClient = DynamoDBDocumentClient.from(dbClient);

  console.log('🔍 Finding all records for:', email);

  // Scan for all user records with Ken's email
  const scanParams = {
    TableName: tableName,
    FilterExpression: 'email = :email AND #type = :userType',
    ExpressionAttributeValues: {
      ':email': email,
      ':userType': 'USER'
    },
    ExpressionAttributeNames: {
      '#type': 'type'
    }
  };

  const scanCommand = new ScanCommand(scanParams);
  const result = await docClient.send(scanCommand);

  if (!result.Items || result.Items.length === 0) {
    console.log('❌ No user records found');
    return;
  }

  console.log('📋 Found records:', result.Items.map(item => ({
    id: item.id,
    role: item.role,
    provider: item.provider
  })));

  for (const item of result.Items) {
    if (item.role === 'guest' && item.provider === 'credentials') {
      // Delete the guest credentials record
      console.log('🗑️ Deleting guest credentials record:', item.id);
      const deleteParams = {
        TableName: tableName,
        Key: {
          pkey: item.pkey,
          skey: item.skey
        }
      };
      await docClient.send(new DeleteCommand(deleteParams));
      console.log('✅ Deleted guest record');
      
    } else if (item.role === 'admin') {
      // Update admin to owner
      console.log('👑 Updating admin to owner:', item.id);
      const updateParams = {
        TableName: tableName,
        Key: {
          pkey: item.pkey,
          skey: item.skey
        },
        UpdateExpression: 'SET #role = :ownerRole',
        ExpressionAttributeNames: {
          '#role': 'role'
        },
        ExpressionAttributeValues: {
          ':ownerRole': 'owner'
        },
        ReturnValues: 'ALL_NEW'
      };
      const updateResult = await docClient.send(new UpdateCommand(updateParams));
      console.log('✅ Updated to owner:', updateResult.Attributes.role);
    }
  }

  console.log('🎉 Role fix completed');
}

fixKenRole().catch(console.error);