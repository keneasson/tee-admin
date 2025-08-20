# Unified Event Architecture

## Core Principle: Single Source of Truth

TEE Admin follows a **unified event architecture** where there is exactly **one** of each core entity, accessed through multiple interfaces.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SINGLE EVENT SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│  Types: @my/app/types/events.ts                                │
│  - StudyWeekendEvent, FuneralEvent, WeddingEvent               │
│  - BaptismEvent, GeneralEvent, RecurringEvent                  │
│  - Single Event interface with discriminated unions            │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
┌───────────────────▼───┐  ┌──────▼──────┐  ┌──▼──────────────────┐
│   MAIN EVENT EDITOR   │  │  NEWSLETTER │  │   SPECIAL EVENTS    │
│   /admin/events/*     │  │  CURATION   │  │   PAGES (Future)    │
├───────────────────────┤  │  /admin/    │  ├─────────────────────┤
│ • ProgressiveEventForm│  │  newsletter/│  │ • Public event pages│
│ • Full event creation │  │  curate     │  │ • Event details     │
│ • All event types     │  ├─────────────┤  │ • Registration      │
│ • Document management │  │ • Add events│  │ • SEO-friendly URLs │
│ • Preview & publish   │  │ • Newsletter│  │ • Social sharing    │
└───────────────────────┘  │   preview   │  └─────────────────────┘
                           │ • Email     │
                           │   generation │
                           └─────────────┘
```

## Shared Components Architecture

### 1. Event Form Components (`packages/ui/src/events/`)
- **LocationSection** - Comprehensive location management
- **SpeakerSection** - Speaker details with ecclesia search
- **ScheduleSection** - Event timeline and activities
- **RegistrationSection** - Registration requirements
- **EventTypeSelector** - Event type selection with descriptions
- **ProgressiveEventForm** - Main event creation workflow

### 2. Form Controls (`packages/ui/src/form/`)
- **EventFormInput** - Standardized input fields
- **EventDatePicker** - Date/time selection
- **EcclesiaSearchInput** - Ecclesia lookup with caching
- **LocationSelect** - Country/province dropdowns
- **OptimizedTextarea** - Text areas with character limits

### 3. Event Types (`packages/app/types/events.ts`)
- **Single source of truth** for all event interfaces
- **Discriminated unions** for type safety
- **Shared interfaces** for common components (LocationDetails, Speaker, etc.)

## Access Patterns

### Primary Event Creation: `/admin/events/create`
```typescript
// Full-featured event editor
<ProgressiveEventForm
  onSave={handleSave}
  onPreview={handlePreview}
  isLoading={isLoading}
/>
```

### Newsletter Integration: `/admin/newsletter/curate`
```typescript
// Quick event creation for newsletters
<RecurringEventForm
  event={selectedEvent}
  onSave={saveRecurringEvent}
  onCancel={() => setShowRecurringEventForm(false)}
/>
```

### Future: Special Events Pages: `/events/[slug]`
```typescript
// Public-facing event display
<EventDetailPage
  event={event}
  showRegistration={true}
  enableSharing={true}
/>
```

## Data Flow

```
Event Creation (Any Interface)
         │
         ▼
   Validation & Processing
         │
         ▼
    DynamoDB Storage
    (Single events table)
         │
         ▼
   ┌─────────────────────┐
   │  Event Consumption  │
   ├─────────────────────┤
   │ • Newsletter emails │
   │ • Event detail pages│
   │ • RSS feeds         │
   │ • Calendar exports  │
   │ • Search results    │
   └─────────────────────┘
```

## Implementation Rules

### ✅ DO: Shared Components
- Use **ProgressiveEventForm** for all complex event creation
- Use **LocationSection** for all location inputs
- Use **EventTypeSelector** for all type selection
- Use **same validation rules** across all interfaces
- Use **same event interfaces** from `@my/app/types/events`

### ❌ DON'T: Duplicate Logic
- Don't create separate form components for different interfaces
- Don't duplicate event type definitions
- Don't create interface-specific validation logic
- Don't maintain separate event storage systems

## Current Integration Status

### ✅ Completed Integrations
- **Event Types**: Single source in `@my/app/types/events.ts`
- **Event Form Components**: Shared across main editor and newsletter
- **LocationSection**: Used in both ProgressiveEventForm and RecurringEventForm
- **Event Type Selector**: Includes all 6 event types consistently

### 🔄 Areas Needing Alignment
- **Newsletter RecurringEventForm**: Currently simplified - should use ProgressiveEventForm
- **Event Storage**: Ensure both paths write to same DynamoDB structure
- **Validation Logic**: Consolidate validation between interfaces

## Recommended Consolidation

### Phase 1: Newsletter Form Alignment
Replace the simplified `RecurringEventForm` in newsletter curation with the full `ProgressiveEventForm`:

```typescript
// Instead of custom RecurringEventForm
<ProgressiveEventForm
  selectedType="recurring"
  skipTypeSelection={true}
  onSave={handleNewsletterEventSave}
  compact={true}  // Streamlined UI for newsletter context
/>
```

### Phase 2: Unified Event API
Ensure all event creation paths use the same API endpoints:
- `POST /api/events` - Create event (from any interface)
- `PUT /api/events/[id]` - Update event
- `GET /api/events/[id]` - Retrieve event
- `DELETE /api/events/[id]` - Delete event

### Phase 3: Event Pages Generation
When building special event pages, use the existing event data:
- SEO-friendly URLs from event metadata
- Shared components for event display
- Same registration and contact workflows

## Benefits of Unified Architecture

1. **Consistency**: Same user experience across all interfaces
2. **Maintainability**: Changes in one place affect all interfaces
3. **Type Safety**: Single source of truth for TypeScript interfaces
4. **Performance**: Shared components are cached and optimized
5. **Testing**: Test once, works everywhere
6. **Data Integrity**: Single storage system prevents data drift

## Component Usage Guidelines

When adding new event-related features:

1. **Check existing components first** - Don't reinvent the wheel
2. **Extend shared components** - Add props for different contexts
3. **Use discriminated unions** - Leverage TypeScript for type safety
4. **Follow naming conventions** - Event*, Section, Form patterns
5. **Test across all interfaces** - Ensure changes work everywhere

This architecture ensures that whether users create events through the main editor, newsletter curation, or future interfaces, they're all working with the same robust, well-tested system.