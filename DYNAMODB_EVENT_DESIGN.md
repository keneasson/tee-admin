# DynamoDB Event Design - Simplified & Realistic

## Problem Analysis
- Current GSI sort keys include date/time that can change
- GSI updates trigger delete/recreate (eventual consistency issues)
- Primary use case: Newsletter/Events page (chronological display)
- Secondary: Admin views (same pattern, different filters)

## Core Requirements
1. **No Event Stubbing**: Only save events with title + eventID + date minimum
2. **Date Changes**: Rare but must be supported cleanly  
3. **Time Optional**: Can be null/empty, part of schedule later
4. **Query Pattern**: Chronological events for newsletter/website

## Simplified Solution: Date-Based GSI Keys

```
PK: EVENT#{id}
SK: DETAILS

GSI1PK: EVENTS                    ← Simple partition for all events
GSI1SK: ${date}#{id}              ← Example: "2025-10-12#uuid123"

// Fields
date: "2025-10-12"                ← Required (year-month-day, don't save without this)
time: "10:00" | null              ← Optional (can be null or part of schedule)
title: "Sussex Weekend"           ← Required
eventType: "study-weekend"        ← Required
ecclesia: "Toronto East..."       ← For filtering
published: true/false             ← For newsletter filtering
```

## Query Patterns

### 1. Newsletter/Website Events (Primary Use Case)
```javascript
// Get next 30 days of published events
const today = "2025-10-12"
const endDate = "2025-11-12"
const params = {
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
  FilterExpression: 'published = :published',
  ExpressionAttributeValues: {
    ':pk': 'EVENTS',
    ':start': today,
    ':end': endDate,
    ':published': true
  }
}
// Returns events sorted by date automatically (GSI1SK: date#id)
```

### 2. Email Newsletter (1-2x per week)
```javascript
// Get next 60 days of published events
const today = "2025-10-12"
const twoMonthsOut = "2025-12-12"
const params = {
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
  FilterExpression: 'published = :published',
  ExpressionAttributeValues: {
    ':pk': 'EVENTS',
    ':start': today,
    ':end': twoMonthsOut,
    ':published': true
  }
}
// Returns chronologically sorted events for newsletter
```

### 3. Admin View (Can be slower)
```javascript
// Get all events in date range (no published filter)
const params = {
  IndexName: 'GSI1', 
  KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': 'EVENTS',
    ':start': '2025-10-01',
    ':end': '2025-10-31'
  }
}
// Shows all events (drafts + published)
```

## Benefits

### ✅ Handles Date Changes Cleanly
- **Rare Changes**: When event date changes, only GSI1SK changes (date#id)
- **Single GSI**: Only one GSI to update, minimal eventual consistency impact
- **Predictable**: Month rarely changes, so mostly just day changes within same partition

### ✅ Optimized for Primary Use Case  
- **Newsletter Queries**: Single GSI query for current month's published events
- **Automatic Sorting**: GSI1SK (date#id) provides chronological order
- **Efficient Filtering**: Published filter applied to small result set

### ✅ Simple & Practical
- **No Over-Engineering**: Single GSI serves all use cases
- **Month Partitioning**: Natural data boundaries (10-50 events per month)
- **No Stubbing**: Only save complete events (title+date+id minimum)

### ✅ Cost Effective
- **Minimal GSI Usage**: One query per month typically
- **Small Partitions**: 10-50 events per month = very fast queries
- **Rare Updates**: Date changes are uncommon

## Implementation Strategy

### Phase 1: Update Form Logic
```javascript
// Don't save until we have minimum viable event
const canSave = formData.title && formData.date && eventId
if (!canSave) {
  // Show "Please add title and date to save" message
  return
}
```
hwh
### Phase 2: Update eventToScheduleRecord()
```javascript
const eventDate = extractEventDate(event) // "2025-10-12" (year-month-day)
const eventTime = extractEventTime(event) // "10:00" or null

return {
  PK: `EVENT#${eventId}`,
  SK: 'DETAILS',
  GSI1PK: 'EVENTS',                      // Simple partition
  GSI1SK: `${eventDate}#${eventId}`,     // Full date + ID for uniqueness
  
  date: eventDate,                       // Required: "2025-10-12"
  time: eventTime || null,               // Optional: "10:00" or null
  // ... other fields
}
```

### Phase 3: Update Query Functions
```javascript
// Replace complex multi-GSI queries with simple month-based queries
const getEventsForNewsletter = (startDate, endDate) => {
  const months = getMonthsBetween(startDate, endDate)
  return Promise.all(months.map(month => queryEventsByMonth(month)))
}
```

This approach is **simple, practical, and handles your actual use cases efficiently**.