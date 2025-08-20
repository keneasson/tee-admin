# Event Management System - Admin/Owner Feature

## Overview
Create a comprehensive event management system that allows Admin/Owner users to create, manage, and publish various types of ecclesial events with flexible structure and progressive disclosure.

## User Story
**As an Admin/Owner**, I want to create and manage events of different types (Study Weekends, Funerals, Weddings, etc.) so that I can publish detailed event information to the community with minimal initial effort and progressive enhancement as details become available.

## Requirements

### 1. User Access Control
- **Restriction**: Only Admin and Owner roles can create/edit events
- **Viewing**: All users can view published events
- **Status Visibility**: Unpublished events only visible to Admin/Owner

### 2. Event Types (Discriminated Union)
Events should use TypeScript discriminated unions based on event type:

#### Core Event Types:
- **Study Weekend**
  - Date range (start/end)
  - Location details
  - Theme/topic
  - Speaker(s)
  - Sub-events (meals, sports, etc.)
  - Registration info & fees
  - Multi-day schedule support
  
- **Funeral**
  - Date/time
  - Location (viewing/service)
  - Deceased person details
  - Service details
  
- **Wedding**
  - Date/time
  - Location
  - Couple details
  - Reception info
  
- **General Event** (catch-all)
  - Flexible fields
  - Custom type naming

### 3. Progressive Form Design
#### Minimal Initial Creation:
- Event title (required)
- Event type selection (required)
- Publish date (optional - defaults to draft)

#### Progressive Enhancement:
- **Dynamic form sections** based on event type
- **Optional components** that can be added:
  - 📅 Date/Time blocks
  - 📍 Location details
  - 🎤 Talk/Presentation blocks
  - 👥 Speaker assignments
  - 🍽️ Meal/Activity blocks
  - 💰 Registration/Fee blocks
  - 📄 Document attachments
  - 🔗 External links

#### Form UX Features:
- **Add Component** buttons (+ Talk, + Activity, + Speaker, etc.)
- **Drag & drop reordering** for multi-day schedules
- **Smart defaults** based on event type
- **Auto-save** as user types
- **Validation** only on publish, not during creation

### 4. Publishing System
#### Draft State:
- Events start as drafts
- Only visible to Admin/Owner
- Can be edited freely

#### Publication:
- **Publish Date**: When event becomes visible
- **Auto-publish**: Events auto-appear on publish date
- **Manual publish**: Immediate publication option
- **NEW badge**: Shows for 5 days after publication

#### Timeline Display:
- **Chronological ordering** on events page
- **Upcoming vs Past** event sections
- **Featured events** option for important items

### 5. Document Management
- **PDF upload/storage** (AWS S3 or similar)
- **File preview** capability
- **Download links**
- **External registration** links
- **Multiple attachments** per event

### 6. Data Architecture

#### Base Event Type:
```typescript
interface BaseEvent {
  id: string
  title: string
  type: EventType
  createdBy: string
  createdAt: Date
  updatedAt: Date
  publishDate?: Date
  published: boolean
  status: 'draft' | 'published' | 'archived'
}

type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'general'

interface StudyWeekendEvent extends BaseEvent {
  type: 'study-weekend'
  dateRange: { start: Date; end: Date }
  location: LocationDetails
  theme: string
  speakers: Speaker[]
  schedule: ScheduleItem[]
  registration?: RegistrationDetails
  documents: DocumentAttachment[]
}

interface FuneralEvent extends BaseEvent {
  type: 'funeral'
  serviceDate: Date
  viewingDate?: Date
  deceased: PersonDetails
  locations: {
    viewing?: LocationDetails
    service: LocationDetails
  }
  // ... other funeral-specific fields
}

// Similar for Wedding, General, etc.
```

### 7. Technical Implementation

#### Frontend:
- **Form Builder Component**: Dynamic form generation based on event type
- **Component Library**: Reusable event form components
- **Rich Text Editor**: For descriptions and details
- **File Upload**: Drag & drop document upload
- **Date/Time Pickers**: User-friendly scheduling

#### Backend:
- **Event API**: CRUD operations with role-based access
- **File Storage**: Document upload/management
- **Auto-publish**: Scheduled job to publish events
- **Validation**: Type-specific validation rules

#### Database Schema:
- **Events table**: Core event data
- **Event_Components**: Flexible component storage (talks, activities, etc.)
- **Event_Documents**: File attachments
- **Event_Speakers**: Speaker assignments

### 8. User Experience Flow

#### Creation Flow:
1. **Event Type Selection** → Dynamic form appears
2. **Minimal Info Entry** → Title + basics
3. **Save as Draft** → Event created
4. **Progressive Enhancement** → Add components as needed
5. **Set Publish Date** → Schedule or publish immediately

#### Management Flow:
- **Event List**: Filterable by type, status, date
- **Quick Actions**: Publish, Edit, Archive, Clone
- **Preview Mode**: See how event appears to users
- **Bulk Operations**: Mass publish/archive

### 9. Future Considerations
- **Event Templates**: Save common event patterns
- **Recurring Events**: Annual events with automatic creation
- **Email Notifications**: Notify community of new events
- **Calendar Integration**: Export to external calendars
- **Event Analytics**: Track views, downloads, registrations
- **Multi-language**: Support for different languages

### 10. Acceptance Criteria

#### Must Have:
- [ ] Role-based access control (Admin/Owner only)
- [ ] Event type discrimination with type-specific forms
- [ ] Minimal creation with progressive enhancement
- [ ] Draft/publish workflow with scheduled publishing
- [ ] Document upload and management
- [ ] Chronological event display with NEW badges
- [ ] Mobile-responsive form design

#### Should Have:
- [ ] Auto-save functionality
- [ ] Event cloning/templates
- [ ] Drag & drop component reordering
- [ ] Rich text editing capabilities
- [ ] File preview functionality

#### Could Have:
- [ ] Event analytics
- [ ] External calendar export
- [ ] Email notifications
- [ ] Event templates
- [ ] Bulk operations

### 11. Technical Notes
- Use **TypeScript discriminated unions** for type safety
- Implement **optimistic updates** for better UX
- Consider **event sourcing** for audit trail
- Use **feature flags** for gradual rollout
- Ensure **accessibility** compliance (WCAG 2.1)

### 12. Dependencies
- File upload service (AWS S3 or similar)
- Rich text editor component
- Date/time picker library
- Form validation library
- Role-based access control system

---

## Next Steps
1. **Review and refine** requirements with stakeholders
2. **Create detailed wireframes** for form flows
3. **Design database schema** with sample data
4. **Create component library** for form elements
5. **Implement MVP** with basic event types
6. **Iterate based on user feedback**

---

**Priority**: High  
**Complexity**: Large  
**Estimated Effort**: 3-4 sprints  
**Dependencies**: Role system, file upload, UI components