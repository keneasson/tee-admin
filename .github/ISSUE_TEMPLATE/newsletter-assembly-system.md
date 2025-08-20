# Newsletter Assembly System - Rule-Based Content Automation

## 🎯 **Objective**
Build an intelligent Newsletter Assembly System that automatically generates 90% complete newsletter previews using rule-based logic, with minimal human curation needed for edge cases.

## 📋 **Core Philosophy**
- **Assembly, not Curation**: Decisions are made during event creation (Event Editor) or by automated rules (JSON configuration)
- **90% Automation**: System auto-generates complete newsletter drafts requiring minimal manual intervention
- **Rule-Based Inclusion**: Events are included/excluded based on `published_at`, `event_date`, and configurable business rules
- **Exception Handling**: Curators can override rules for special circumstances (add/remove items outside normal rules)

## 🏗️ **System Architecture**

### **1. Newsletter Assembly Engine**

#### **Core Components**
- **Newsletter Rules Configuration (JSON)**: Defines inclusion/exclusion logic, content ordering, and display rules
- **Event Service Integration**: Pulls all published events from DynamoDB Event Manager
- **Schedule Service Integration**: Pulls regular services (Memorial, Sunday School, Bible Class) from existing systems
- **Bible Readings Integration**: Email-friendly table layout for 7-day reading schedule
- **Assembly Processor**: Combines all data sources using rules to generate newsletter preview

#### **Newsletter Rules Configuration (`newsletter-rules.json`)**
```json
{
  "mandatoryContent": {
    "sunday": {
      "memorial": {
        "alwaysInclude": true,
        "time": "11:00 AM",
        "exceptions": [
          {
            "reason": "Toronto North Study Day",
            "alternateMessage": "No Memorial Service - Toronto North Study Day"
          },
          {
            "reason": "Easter Fraternal Gathering", 
            "alternateMessage": "No Memorial Service - Easter Fraternal Gathering"
          }
        ]
      },
      "sundaySchool": {
        "schedule": "September to June",
        "time": "9:30 AM",
        "summerMessage": "No Sunday School during summer months"
      }
    },
    "bibleClass": {
      "alwaysInclude": true,
      "schedule": "Wednesday/Thursday 7:30 PM",
      "platform": "Zoom"
    },
    "standingEvents": {
      "bibleEffectively": {
        "title": "Learn To Read The Bible Effectively",
        "schedule": "Every Monday 7:00-8:30 PM",
        "alwaysInclude": true
      }
    }
  },
  "eventTypes": {
    "study-weekend": {
      "displayDuration": "until_event_date",
      "priority": 10,
      "includeInSummary": true,
      "maxSummaryLength": 200,
      "requiresCTA": true,
      "ctaText": "Full Details & Registration"
    },
    "funeral": {
      "displayDuration": "3_weeks_from_first_inclusion",
      "priority": 8,
      "includeInSummary": false,
      "showFullContent": true
    },
    "wedding": {
      "displayDuration": "3_weeks_or_until_event_date",
      "priority": 7,
      "includeInSummary": true,
      "maxSummaryLength": 150,
      "showFullContent": false
    },
    "baptism": {
      "displayDuration": "1_week_after_event",
      "priority": 9,
      "includeInSummary": false,
      "showFullContent": true
    },
    "general": {
      "displayDuration": "until_event_date",
      "priority": 5,
      "includeInSummary": true,
      "maxSummaryLength": 150
    }
  },
  "contentOrdering": [
    "daily_readings",
    "this_week_bible_class", 
    "next_week_bible_class",
    "this_sunday_services",
    "next_sunday_services",
    "priority_events_desc",
    "standing_events"
  ],
  "validation": {
    "requiredFields": {
      "memorial": ["preside", "exhort", "organist", "steward", "doorkeeper"],
      "sundaySchool": ["refreshments"],
      "bibleClass": ["speaker", "topic"]
    },
    "notifications": {
      "missingFields": "email_admin",
      "unusualPatterns": "email_admin"
    }
  }
}
```

### **2. Event Service Integration**

#### **Newsletter-Specific Event Fields**
```typescript
interface Event {
  // ... existing fields
  newsletter?: {
    includeInNewsletter: boolean
    newsletterPriority: number  // 1-10, higher = more important
    displayDuration?: 'until_event_date' | '1_week' | '2_weeks' | '3_weeks' | 'custom'
    customDisplayEndDate?: Date
    summary?: string  // Curated summary for newsletter
    fullContent?: string  // Full content for newsletter
    firstIncludedDate?: Date  // Track when first included for duration rules
    ctaButton?: {
      text: string
      url: string
    }
  }
}
```

#### **Newsletter Events Query**
- **Published Events**: `status: 'published'` AND `publishDate <= now`
- **Date Range**: Events within newsletter scope (past 30 days to future 6 months)
- **Exclusions**: Events with `metadata.isPrivate: true`
- **Duration Rules**: Apply event type-specific display duration logic

### **3. Assembly Process (Auto-Generated 90% Complete)**

#### **Thursday 6 AM: Auto-Assembly Trigger**
```typescript
interface NewsletterAssembly {
  // Regular Services (Always included)
  thisWeek: {
    sundayServices: {
      memorial: MemorialService
      sundaySchool: SundaySchoolService | null  // null during summer
    }
    bibleClass: BibleClassService
    dailyReadings: DailyReading[]  // 7 days starting Friday
  }
  
  nextWeek: {
    sundayServices: SundayServicesPreview
    bibleClass: BibleClassService
  }
  
  // Dynamic Events (Rule-based inclusion)
  priorityEvents: Event[]  // Sorted by newsletter priority
  
  // Standing Content
  standingEvents: StandingEvent[]
  
  // Validation Results
  validation: {
    missingFields: ValidationError[]
    warnings: string[]
    completenessScore: number  // 0-100%
  }
}
```

#### **Assembly Logic**
1. **Pull Regular Services**: Memorial, Sunday School, Bible Class from existing systems
2. **Query Newsletter Events**: Get all published events within date range
3. **Apply Duration Rules**: Filter events based on type-specific display duration
4. **Apply Priority Sorting**: Order events by newsletter priority (high to low)
5. **Generate Content**: Apply summary/full content rules based on event type
6. **Validate Completeness**: Check for missing required fields
7. **Generate Preview**: Create email-ready preview with all content sections

### **4. Bible Readings Email Layout**

#### **Responsive Table Design**
```html
<!-- Mobile-friendly stacked layout -->
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background-color: #f5f5f5;">
      <th style="padding: 8px; border: 1px solid #ddd;">Day</th>
      <th style="padding: 8px; border: 1px solid #ddd;">Reading 1</th>
      <th style="padding: 8px; border: 1px solid #ddd;">Reading 2</th>
      <th style="padding: 8px; border: 1px solid #ddd;">Reading 3</th>
    </tr>
  </thead>
  <tbody>
    <!-- 7 rows: Friday (tomorrow) through Thursday (next week) -->
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Friday, Mar 1</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Genesis 1</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Psalms 1</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Matthew 1</td>
    </tr>
    <!-- ... continue for 7 days -->
  </tbody>
</table>

<!-- Mobile stack for narrow screens -->
<style>
  @media (max-width: 600px) {
    .readings-table tr, .readings-table td {
      display: block;
      width: 100%;
    }
    .readings-table td:before {
      content: attr(data-label) ": ";
      font-weight: bold;
    }
  }
</style>
```

### **5. Minimal Curation Interface**

#### **Thursday Evening Curation (Optional Override)**
- **90% Complete Preview**: Display assembled newsletter exactly as it will be sent
- **Override Controls**: 
  - ✅ **Remove Event**: Hide specific events (override inclusion rules)
  - ✅ **Add Event**: Include events outside normal rules (draft events, archived events)
  - ✅ **Reorder Priority**: Temporarily adjust event display order
  - ✅ **Edit Summary**: Quick edit event summaries without changing source
  - ✅ **Add Custom Content**: Insert custom announcements not in Event Manager

#### **Curation Actions (Exception Handling)**
```typescript
interface CurationOverride {
  type: 'remove_event' | 'add_event' | 'reorder' | 'edit_summary' | 'add_custom'
  eventId?: string
  customContent?: string
  newSummary?: string
  newOrder?: number[]
  reason: string  // Why this override was needed
}
```

#### **Quality Assurance**
- **Completeness Check**: Verify all required fields present (95%+ score)
- **Content Validation**: Check for broken links, missing contact info
- **Email Preview**: Exact rendering preview for multiple email clients
- **Send Test**: Option to send test email to admin team

### **6. Content Source Priority**

#### **Data Source Hierarchy**
1. **DynamoDB Events** (Primary): All event data from Event Manager system
2. **Regular Services APIs**: Memorial, Sunday School, Bible Class schedules  
3. **Bible Readings API**: Daily reading schedule
4. **Curation Overrides**: Manual exceptions applied during Thursday review
5. **Newsletter Rules**: Fallback content and validation rules

#### **Google Sheets Fallback**
- Only used if DynamoDB unavailable (error handling)
- System should log warning when falling back to Sheets
- Automatic retry of DynamoDB before each newsletter send

## 🔧 **Technical Implementation**

### **Phase 1: Newsletter Rules Engine (2 weeks)**
- [ ] Create `newsletter-rules.json` configuration schema
- [ ] Build rules validation system
- [ ] Implement event duration logic (3 weeks, until event date, etc.)
- [ ] Create content ordering engine
- [ ] Add missing field validation and notifications

### **Phase 2: Assembly Engine (3 weeks)**
- [ ] Build newsletter assembly processor
- [ ] Integrate with existing Event Service (`getNewsletterEvents`)
- [ ] Connect to regular services APIs (Memorial, Bible Class, Sunday School)
- [ ] Implement Bible readings email layout
- [ ] Create 90% complete preview generation

### **Phase 3: Minimal Curation Interface (2 weeks)**
- [ ] Build Thursday curation page (`/admin/newsletter/curate`)
- [ ] Implement override controls (remove, add, reorder events)
- [ ] Add custom content insertion capability
- [ ] Create quality assurance validation
- [ ] Build email preview with multi-client testing

### **Phase 4: Error Handling & Notifications (1 week)**
- [ ] Implement missing field detection and admin notifications
- [ ] Add DynamoDB fallback to Google Sheets
- [ ] Create assembly error logging and recovery
- [ ] Build completeness scoring system
- [ ] Add automated quality checks

### **Phase 5: Integration & Testing (1 week)**
- [ ] Connect with existing email sending system (issue #15)
- [ ] Implement Thursday 6 AM auto-assembly trigger
- [ ] Add curation override persistence
- [ ] Create comprehensive testing suite
- [ ] Deploy with monitoring and alerting

## 📊 **Data Models**

### **Newsletter Assembly Schema**
```typescript
interface NewsletterAssembly {
  id: string
  date: Date  // Newsletter send date (Thursday)
  assemblyDate: Date  // When auto-generated (Thursday 6 AM)
  status: 'auto_generated' | 'under_review' | 'approved' | 'sent'
  
  // Assembled Content
  content: {
    regularServices: RegularServices
    events: AssembledEvent[]
    standingContent: StandingContent[]
    dailyReadings: DailyReading[]
  }
  
  // Curation Overrides
  overrides: CurationOverride[]
  
  // Quality Metrics
  validation: {
    completenessScore: number  // 0-100
    missingFields: string[]
    warnings: string[]
    readyToSend: boolean
  }
  
  // Approval Workflow
  reviewedBy?: string
  reviewedAt?: Date
  approvedBy?: string
  approvedAt?: Date
  sentAt?: Date
}

interface AssembledEvent {
  eventId: string
  title: string
  type: string
  priority: number
  
  // Content Format
  displayType: 'summary' | 'full' | 'title_only'
  content: string
  summary?: string
  ctaButton?: {
    text: string
    url: string
  }
  
  // Assembly Metadata
  includedByRule: string  // Which rule included this event
  overriddenByUser: boolean
  firstIncludedDate?: Date
}
```

### **Newsletter Rules Schema**
```typescript
interface NewsletterRules {
  version: string
  lastUpdated: Date
  
  mandatoryContent: MandatoryContent
  eventTypes: Record<string, EventTypeRule>
  contentOrdering: string[]
  validation: ValidationRules
  
  // Future: A/B testing rules, personalization rules
}

interface EventTypeRule {
  displayDuration: 'until_event_date' | '1_week' | '2_weeks' | '3_weeks' | 'custom'
  priority: number  // 1-10
  includeInSummary: boolean
  maxSummaryLength?: number
  showFullContent: boolean
  requiresCTA: boolean
  ctaText?: string
}
```

## 🎯 **Success Metrics**

### **Automation Goals**
- **90%+ Auto-Assembly**: Newsletter requires <10% manual intervention
- **95%+ Completeness**: Auto-generated newsletters have all required content
- **<5 minutes Curation**: Thursday review takes <5 minutes for typical week
- **Zero Manual Data Entry**: All content pulled automatically from existing systems

### **Quality Goals**
- **100% Required Content**: Memorial, Sunday School, Bible Class always included (when applicable)
- **Accurate Event Lifecycle**: Events appear/disappear based on rules without manual management
- **Consistent Formatting**: Professional, branded email layout matching existing standards
- **Error-Free Delivery**: No broken links, missing information, or formatting issues

### **Operational Goals**
- **Reliable Thursday 6 AM Generation**: Auto-assembly triggers successfully 99%+ of time
- **Flexible Override System**: Curators can handle edge cases without developer intervention
- **Audit Trail**: All changes and overrides logged for troubleshooting
- **Graceful Fallbacks**: System continues working even with partial data source failures

## 🚀 **Migration Strategy**

### **Current Problem**
- Manual newsletter generation every Thursday is failing
- Need immediate replacement with automated assembly system
- No transition period - direct replacement of manual process

### **Phase 1: Development & Testing (Using Existing Test Infrastructure)**
- Build complete newsletter assembly system
- **Leverage Existing Test Setup**: Use current SES test sender list for comprehensive testing
- **Email Client Testing**: Test rendering across Gmail, Outlook, Apple Mail, etc. using test emails
- **Content Validation**: Validate assembly logic against historical newsletter content
- **Integration Testing**: Verify assembly system works with existing AWS SES infrastructure and rate limiting
- **Error Scenarios**: Test fallback behavior when DynamoDB/APIs fail

### **Phase 2: Controlled Production Deployment**
- **Manual Send Mode**: Generate newsletter, curator reviews, manually send to distribution list
- Verify assembly accuracy with real production data
- Refine rules based on actual usage patterns
- Build confidence in system reliability

### **Phase 3: Automated Sending (After 100% Confidence)**
- **Semi-Automated**: Thursday 6 AM auto-generation + Thursday 7 PM manual send approval
- **Fully Automated**: Thursday 7 PM auto-send (only after cron job thoroughly tested)
- Multiple safety checks to prevent accidental wrong email sends

## 📋 **Acceptance Criteria**

### **Must Have**
- ✅ Newsletter rules configuration system with JSON schema
- ✅ 90% complete auto-assembly from DynamoDB events and regular services
- ✅ Event lifecycle management (appear after publish_at, disappear based on type rules)
- ✅ Bible readings email-friendly table layout (7 days)
- ✅ Minimal curation interface with override capabilities
- ✅ Missing field validation and admin notifications
- ✅ Quality assurance with completeness scoring
- ✅ Thursday 6 AM auto-generation trigger

### **Should Have**
- ✅ Content versioning and rollback capability
- ✅ A/B testing framework for newsletter layouts
- ✅ Analytics on curation override frequency
- ✅ Event summary auto-generation using AI
- ✅ Mobile-responsive curation interface

### **Could Have**
- ✅ Personalized content based on subscriber preferences
- ✅ Integration with social media posting
- ✅ Newsletter archive with search capability
- ✅ Automated subject line generation
- ✅ Multi-language newsletter support

## 🔗 **Dependencies**

- ✅ **Event Manager System**: DynamoDB events with newsletter fields
- ✅ **Regular Services APIs**: Memorial, Sunday School, Bible Class schedules
- ✅ **Bible Readings API**: Daily reading schedule data
- ✅ **Email Sending System**: Newsletter delivery infrastructure (issue #15)
- ⚠️ **Admin Authentication**: Secure access to curation interface
- ⚠️ **Email Template System**: React Email components for consistent formatting

## ⚠️ **Risk Mitigation**

### **Technical Risks**
- **DynamoDB Dependency**: Implement Google Sheets fallback for data source failures
- **Rules Complexity**: Start simple, iterate based on real usage patterns
- **Auto-Assembly Accuracy**: Shadow mode testing to validate before full deployment
- **Email Formatting**: Extensive testing across email clients and devices

### **Operational Risks**
- **Curator Training**: Detailed documentation and minimal interface design
- **Thursday Deadline**: Multiple retry mechanisms and manual override capability
- **Content Quality**: Validation rules and approval workflow before sending
- **Emergency Scenarios**: Manual newsletter creation capability as ultimate fallback

---

**Priority**: High  
**Complexity**: Medium  
**Impact**: High (Significant time savings + improved consistency)  
**Timeline**: ~9 weeks total development + 2-3 weeks testing & production deployment