# YouTube Livestream Management - Setup Guide

## Overview

The YouTube Livestream Management feature allows admins to create and manage YouTube livestreams for Sunday Memorial services directly from the TEE Admin interface. This feature automatically syncs livestream URLs to Google Sheets and DynamoDB, which are then included in email notifications.

## Features

- ✅ Create new YouTube livestreams from the admin interface
- ✅ List and view upcoming livestreams
- ✅ Copy encoder settings from previous streams (template feature)
- ✅ Automatic sync to Google Sheets (Memorial schedule)
- ✅ Automatic sync to DynamoDB via existing webhook
- ✅ YouTube URLs automatically included in Memorial and Newsletter emails
- ✅ One-click URL copying for sharing
- ✅ Direct links to YouTube Studio for stream management

## Architecture

### Data Flow

```
Admin UI → Create Livestream
    ↓
POST /api/youtube/livestreams
    ↓
YouTube Data API v3
    ├─ Create Broadcast
    ├─ Create/Reuse Stream
    └─ Bind Stream to Broadcast
    ↓
Response with Watch URL
    ↓
Update Google Sheets (YouTube column in Memorial schedule)
    ↓
Existing webhook triggers DynamoDB sync
    ↓
Email templates display YouTube link automatically
```

### Components Created

1. **Types** (`packages/app/types/youtube.ts`)
   - TypeScript interfaces for YouTube API data
   - Simplified types for frontend consumption

2. **YouTube API Service** (`packages/app/provider/youtube/youtube-service.ts`)
   - `listLivestreams()` - Get all livestreams
   - `getLivestream(id)` - Get specific livestream
   - `createLivestream(data)` - Create new livestream
   - `updateLivestream(id, updates)` - Update existing livestream
   - `deleteLivestream(id)` - Delete livestream

3. **Google Sheets Sync** (`packages/app/provider/youtube/youtube-sheets-sync.ts`)
   - `updateYouTubeUrl(date, url)` - Update YouTube column in Memorial schedule
   - `findDateRow(sheetId, date)` - Find row matching Sunday date
   - Automatic date matching and column detection

4. **API Endpoints**
   - `GET /api/youtube/livestreams` - List livestreams
   - `POST /api/youtube/livestreams` - Create livestream
   - `GET /api/youtube/livestreams/[id]` - Get specific livestream
   - `PATCH /api/youtube/livestreams/[id]` - Update livestream
   - `DELETE /api/youtube/livestreams/[id]` - Delete livestream (owner only)

5. **Admin UI** (`apps/next/app/admin/(admin-plus)/youtube/page.tsx`)
   - List view with upcoming livestreams
   - Create form with validation
   - Quick actions (copy URL, open Studio, etc.)

## Google Cloud Setup

### Prerequisites

You need to enable the YouTube Data API v3 in your Google Cloud project and grant access to your service account.

### Step 1: Enable YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (`tee-services`)
3. Navigate to **APIs & Services** → **Library**
4. Search for "YouTube Data API v3"
5. Click **Enable**

### Step 2: Add Service Account to YouTube Channel

The service account needs to be a Manager or Owner on the YouTube channel to create livestreams.

1. Go to your Google Service Account JSON file:
   - `apps/next/tee-services-db47a9e534d3.json`
   - Find the `client_email` field (e.g., `tee-admin@tee-services.iam.gserviceaccount.com`)

2. Add the service account to your YouTube channel:
   - Go to [YouTube Studio](https://studio.youtube.com)
   - Click **Settings** → **Permissions**
   - Click **Invite** and enter the service account email
   - Grant **Manager** or **Owner** access
   - Click **Save**

### Step 3: Update Service Account Scopes (Already Done)

The YouTube service already includes the required scopes:
```typescript
scopes: [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]
```

### Step 4: Update Google Sheets Permissions (Write Access)

The YouTubeSheetsSync service needs write permissions to update the Memorial schedule:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Your service account already has these scopes:
   - `https://www.googleapis.com/auth/spreadsheets` (read/write)

3. Ensure the service account has write access to your Memorial schedule Google Sheet:
   - Open the Memorial schedule sheet
   - Click **Share**
   - Add the service account email with **Editor** access

## Usage

### Creating a Livestream

1. Log in as Admin or Owner
2. Navigate to **Admin** → **YouTube Livestreams**
3. Click the **Create New Stream** tab
4. Fill in the form:
   - **Title**: e.g., "Sunday Memorial Service - October 20, 2024"
   - **Description**: Optional description for the livestream
   - **Scheduled Start Time**: Click "Next Sunday" or manually enter (format: YYYY-MM-DDTHH:mm)
   - **Privacy Status**: Public, Unlisted, or Private
   - **Template Broadcast ID**: (Optional) Copy encoder settings from a previous stream

5. Click **Create Livestream**

6. The system will:
   - Create the livestream on YouTube
   - Update the Google Sheets Memorial schedule with the watch URL
   - Trigger DynamoDB sync via existing webhook
   - Display success message with URLs

### Viewing Livestreams

The **Upcoming Streams** tab shows all scheduled livestreams with:
- Title and description
- Scheduled date/time
- Status badge (upcoming, live, complete)
- Quick actions:
  - **Watch Page** - Opens the public watch URL
  - **Studio** - Opens YouTube Studio for stream management
  - **Copy URL** - Copies watch URL to clipboard

### Email Integration

Once a livestream is created and synced:

1. **Google Sheets Update**: The YouTube column in the Memorial schedule is automatically updated with the watch URL

2. **DynamoDB Sync**: The existing webhook system syncs the updated data to DynamoDB

3. **Email Templates**: The `MemorialServiceType` already has a `YouTube` field that's displayed in:
   - Memorial email (`apps/email-builder/emails/Memorial.tsx`)
   - Newsletter email (`apps/email-builder/emails/Newsletter.tsx`)

## Testing

### Manual Testing Checklist

1. **YouTube API Connection**
   - [ ] Service account has YouTube Data API v3 enabled
   - [ ] Service account is added as Manager/Owner on YouTube channel
   - [ ] Can list existing livestreams via `/api/youtube/livestreams`

2. **Create Livestream**
   - [ ] Can access admin page at `/admin/youtube`
   - [ ] Form validation works (required fields)
   - [ ] "Next Sunday" button populates correct date
   - [ ] Successfully creates livestream on YouTube
   - [ ] Returns watch URL and stream URL

3. **Google Sheets Sync**
   - [ ] YouTube URL appears in Memorial schedule sheet
   - [ ] Correct row is updated (matching Sunday date)
   - [ ] Existing webhook triggers DynamoDB sync

4. **DynamoDB Verification**
   - [ ] Check `tee-schedules` table for updated YouTube URL
   - [ ] Verify data matches Google Sheets

5. **Email Integration**
   - [ ] Preview Memorial email - YouTube link appears
   - [ ] Preview Newsletter email - YouTube link appears
   - [ ] Links are clickable and correct

### API Testing with curl

```bash
# List upcoming livestreams
curl -X GET "http://localhost:4000/api/youtube/livestreams?status=upcoming" \
  -H "Cookie: your-auth-cookie"

# Create a new livestream
curl -X POST "http://localhost:4000/api/youtube/livestreams" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "title": "Sunday Memorial Service - Test",
    "description": "Test livestream creation",
    "scheduledStartTime": "2024-10-20T11:00:00Z",
    "privacyStatus": "unlisted"
  }'

# Get specific livestream
curl -X GET "http://localhost:4000/api/youtube/livestreams/BROADCAST_ID" \
  -H "Cookie: your-auth-cookie"
```

## Troubleshooting

### "YouTube API connection failed"

**Cause**: Service account doesn't have YouTube Data API v3 access

**Solution**:
1. Enable YouTube Data API v3 in Google Cloud Console
2. Add service account to YouTube channel as Manager/Owner
3. Wait a few minutes for permissions to propagate

### "Failed to sync YouTube URL to Google Sheets"

**Cause**: Service account doesn't have write access to Memorial schedule sheet

**Solution**:
1. Open Memorial schedule sheet in Google Sheets
2. Share with service account email (Editor access)
3. Ensure YouTubeSheetsSync has write scope

### "Date not found in sheet"

**Cause**: The scheduled date doesn't match any row in Memorial schedule

**Solution**:
1. Ensure the Memorial schedule sheet has a row for the Sunday date
2. Date format in sheet should match (e.g., "Oct 20, 2024" or "2024-10-20")
3. Check the Date column (typically column A) has the correct format

### "Livestream created but not in emails"

**Cause**: DynamoDB webhook didn't trigger or sync failed

**Solution**:
1. Check Google Sheets - is the YouTube URL there?
2. Manually trigger sync from Admin → Data Sync
3. Verify DynamoDB `tee-schedules` table has updated data
4. Check webhook logs in Vercel

## Security

- **Authentication**: All endpoints require admin or owner access
- **Delete Protection**: Only owners can delete livestreams
- **API Rate Limits**: YouTube Data API v3 has quota limits (check usage in Google Cloud Console)
- **Service Account**: Uses same secure service account as Google Sheets integration

## Future Enhancements

Potential improvements for the YouTube livestream feature:

1. **Automatic Scheduling**: Create livestreams automatically for all upcoming Sundays
2. **Stream Health Monitoring**: Check if stream is online before service starts
3. **Recording Management**: Auto-publish recordings after service
4. **Analytics Integration**: Display view counts and engagement metrics
5. **Multi-Channel Support**: Manage livestreams for multiple YouTube channels
6. **Bulk Operations**: Create multiple livestreams at once
7. **Notification System**: Alert admins when stream is live or has issues

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Google Cloud Console for API quota and permissions
3. Check Vercel logs for webhook and API errors
4. Verify service account permissions in Google Sheets and YouTube Studio
