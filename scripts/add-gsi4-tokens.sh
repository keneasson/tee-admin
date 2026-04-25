#!/bin/bash
# Add GSI4 to tee-admin table for O(1) token lookups
# This index enables efficient verification token queries without full table scans
#
# GSI4 Pattern:
#   gsi4pk: TOKEN#{tokenValue}  - Partition by token value for direct lookup
#   gsi4sk: {expiresAt}#{tokenType} - Sort by expiry for TTL queries
#
# Usage:
#   ./scripts/add-gsi4-tokens.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Access to tee-admin table in ca-central-1

set -e

TABLE_NAME="tee-admin"
REGION="ca-central-1"

echo "Adding GSI4 to $TABLE_NAME table in $REGION..."

aws dynamodb update-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --attribute-definitions \
    AttributeName=gsi4pk,AttributeType=S \
    AttributeName=gsi4sk,AttributeType=S \
  --global-secondary-index-updates \
    '[{
      "Create": {
        "IndexName": "gsi4",
        "KeySchema": [
          {"AttributeName": "gsi4pk", "KeyType": "HASH"},
          {"AttributeName": "gsi4sk", "KeyType": "RANGE"}
        ],
        "Projection": {
          "ProjectionType": "ALL"
        }
      }
    }]'

echo ""
echo "GSI4 creation initiated. The index may take several minutes to become active."
echo ""
echo "Monitor progress with:"
echo "  aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION --query 'Table.GlobalSecondaryIndexes[?IndexName==\`gsi4\`].IndexStatus'"
echo ""
echo "Wait for IndexStatus to be 'ACTIVE' before using the TokenRepository."
