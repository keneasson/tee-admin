import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
});

async function checkTable(tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    const result = await client.send(command);
    console.log(`✅ Table '${tableName}' exists`);
    console.log(`   Status: ${result.Table.TableStatus}`);
    console.log(`   Item count: ${result.Table.ItemCount}`);
    if (result.Table.GlobalSecondaryIndexes) {
      console.log(`   GSIs: ${result.Table.GlobalSecondaryIndexes.map(g => g.IndexName).join(', ')}`);
    }
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`❌ Table '${tableName}' does NOT exist`);
      return false;
    }
    throw error;
  }
}

await checkTable('tee-send-queue');
