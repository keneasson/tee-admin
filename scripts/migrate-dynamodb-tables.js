#!/usr/bin/env node
/**
 * DynamoDB Table Migration Script
 * Renames tables by removing stage prefix (dev-tee-* -> tee-*)
 */

const { DynamoDBClient, ListTablesCommand, DescribeTableCommand, CreateTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

const OLD_TABLES = {
  'dev-tee-admin': 'tee-admin',
  'dev-tee-schedules': 'tee-schedules', 
  'dev-tee-sync-status': 'tee-sync-status'
};

async function listExistingTables() {
  console.log('📋 Checking existing tables...');
  try {
    const response = await client.send(new ListTablesCommand({}));
    const teeTabless = response.TableNames.filter(name => name.includes('tee'));
    console.log('Current TEE tables:', teeTabless);
    return teeTabless;
  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
    throw error;
  }
}

async function getTableDefinition(tableName) {
  console.log(`📖 Getting table definition for ${tableName}...`);
  try {
    const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
    const table = response.Table;
    
    // Create table definition from existing table
    const tableDefinition = {
      TableName: OLD_TABLES[tableName],
      KeySchema: table.KeySchema,
      AttributeDefinitions: table.AttributeDefinitions,
      BillingMode: 'PAY_PER_REQUEST', // Always use PAY_PER_REQUEST for new tables
    };

    // Add GSIs if they exist
    if (table.GlobalSecondaryIndexes) {
      tableDefinition.GlobalSecondaryIndexes = table.GlobalSecondaryIndexes.map(gsi => ({
        IndexName: gsi.IndexName,
        KeySchema: gsi.KeySchema,
        Projection: gsi.Projection,
      }));
    }

    // Add LSIs if they exist  
    if (table.LocalSecondaryIndexes) {
      tableDefinition.LocalSecondaryIndexes = table.LocalSecondaryIndexes.map(lsi => ({
        IndexName: lsi.IndexName,
        KeySchema: lsi.KeySchema,
        Projection: lsi.Projection,
      }));
    }

    // Add tags
    tableDefinition.Tags = [
      { Key: 'Project', Value: 'TEE-Admin' },
      { Key: 'Environment', Value: 'production' },
      { Key: 'MigratedFrom', Value: tableName },
    ];

    return tableDefinition;
  } catch (error) {
    console.error(`❌ Error describing table ${tableName}:`, error.message);
    throw error;
  }
}

async function createNewTable(tableDefinition) {
  console.log(`🏗️  Creating new table: ${tableDefinition.TableName}...`);
  try {
    await client.send(new CreateTableCommand(tableDefinition));
    console.log(`✅ Table ${tableDefinition.TableName} created successfully`);
    
    // Wait for table to be active
    console.log(`⏳ Waiting for table ${tableDefinition.TableName} to become active...`);
    let isActive = false;
    while (!isActive) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      const response = await client.send(new DescribeTableCommand({ 
        TableName: tableDefinition.TableName 
      }));
      isActive = response.Table.TableStatus === 'ACTIVE';
      console.log(`   Status: ${response.Table.TableStatus}`);
    }
    
    console.log(`✅ Table ${tableDefinition.TableName} is now active`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  Table ${tableDefinition.TableName} already exists`);
    } else {
      console.error(`❌ Error creating table ${tableDefinition.TableName}:`, error.message);
      throw error;
    }
  }
}

async function copyTableData(sourceTable, targetTable) {
  console.log(`📦 Copying data from ${sourceTable} to ${targetTable}...`);
  
  try {
    let lastEvaluatedKey;
    let totalItems = 0;
    
    do {
      // Scan source table
      const scanParams = {
        TableName: sourceTable,
        Limit: 25, // Process in batches
      };
      
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const scanResponse = await docClient.send(new ScanCommand(scanParams));
      
      if (scanResponse.Items && scanResponse.Items.length > 0) {
        // Batch write to target table
        const writeRequests = scanResponse.Items.map(item => ({
          PutRequest: { Item: item }
        }));
        
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [targetTable]: writeRequests
          }
        }));
        
        totalItems += scanResponse.Items.length;
        console.log(`   Copied ${totalItems} items so far...`);
      }
      
      lastEvaluatedKey = scanResponse.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`✅ Successfully copied ${totalItems} items from ${sourceTable} to ${targetTable}`);
    return totalItems;
  } catch (error) {
    console.error(`❌ Error copying data from ${sourceTable} to ${targetTable}:`, error.message);
    throw error;
  }
}

async function verifyDataCopy(sourceTable, targetTable) {
  console.log(`🔍 Verifying data copy from ${sourceTable} to ${targetTable}...`);
  
  try {
    // Get count from source table
    const sourceResponse = await docClient.send(new ScanCommand({
      TableName: sourceTable,
      Select: 'COUNT'
    }));
    
    // Get count from target table  
    const targetResponse = await docClient.send(new ScanCommand({
      TableName: targetTable,
      Select: 'COUNT'
    }));
    
    const sourceCount = sourceResponse.Count;
    const targetCount = targetResponse.Count;
    
    console.log(`   Source table ${sourceTable}: ${sourceCount} items`);
    console.log(`   Target table ${targetTable}: ${targetCount} items`);
    
    if (sourceCount === targetCount) {
      console.log(`✅ Data copy verified - counts match`);
      return true;
    } else {
      console.error(`❌ Data copy verification failed - counts don't match`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error verifying data copy:`, error.message);
    return false;
  }
}

async function deleteOldTable(tableName) {
  console.log(`🗑️  Deleting old table: ${tableName}...`);
  try {
    await client.send(new DeleteTableCommand({ TableName: tableName }));
    console.log(`✅ Table ${tableName} deleted successfully`);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`⚠️  Table ${tableName} doesn't exist`);
    } else {
      console.error(`❌ Error deleting table ${tableName}:`, error.message);
      throw error;
    }
  }
}

async function migrateTable(oldTableName, newTableName) {
  console.log(`\n🚀 Starting migration: ${oldTableName} -> ${newTableName}`);
  
  try {
    // 1. Get table definition
    const tableDefinition = await getTableDefinition(oldTableName);
    
    // 2. Create new table
    await createNewTable(tableDefinition);
    
    // 3. Copy data
    const itemCount = await copyTableData(oldTableName, newTableName);
    
    // 4. Verify copy
    const verified = await verifyDataCopy(oldTableName, newTableName);
    
    if (verified && itemCount > 0) {
      console.log(`✅ Migration completed successfully: ${oldTableName} -> ${newTableName}`);
      console.log(`   You can now delete the old table with: npm run delete-old-table ${oldTableName}`);
      return true;
    } else {
      console.error(`❌ Migration verification failed for ${oldTableName}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Migration failed for ${oldTableName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 DynamoDB Table Migration: Remove Stage Prefix');
  console.log('================================================');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'list') {
      await listExistingTables();
      return;
    }
    
    if (command === 'delete-old' && args[1]) {
      await deleteOldTable(args[1]);
      return;
    }
    
    if (command === 'migrate') {
      const existingTables = await listExistingTables();
      
      let allSuccess = true;
      for (const [oldTable, newTable] of Object.entries(OLD_TABLES)) {
        if (existingTables.includes(oldTable)) {
          console.log(`\n📋 Found table to migrate: ${oldTable}`);
          const success = await migrateTable(oldTable, newTable);
          if (!success) {
            allSuccess = false;
          }
        } else {
          console.log(`⚠️  Table ${oldTable} not found, skipping...`);
        }
      }
      
      if (allSuccess) {
        console.log('\n🎉 All table migrations completed successfully!');
        console.log('\n📋 Summary of new tables:');
        Object.values(OLD_TABLES).forEach(table => console.log(`   - ${table}`));
        console.log('\n⚠️  Remember to delete old tables after verifying everything works:');
        Object.keys(OLD_TABLES).forEach(table => console.log(`   node scripts/migrate-dynamodb-tables.js delete-old ${table}`));
      } else {
        console.log('\n❌ Some migrations failed. Please check the logs above.');
      }
      
      return;
    }
    
    console.log('Usage:');
    console.log('  node scripts/migrate-dynamodb-tables.js list              # List existing tables');
    console.log('  node scripts/migrate-dynamodb-tables.js migrate           # Migrate all tables');
    console.log('  node scripts/migrate-dynamodb-tables.js delete-old <name> # Delete old table');
    
  } catch (error) {
    console.error('💥 Migration script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}