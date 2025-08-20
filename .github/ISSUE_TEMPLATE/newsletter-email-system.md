# Newsletter Email System - Replace Mailchimp with Custom Solution

## 🎯 **Objective**
Build a comprehensive, free, and highly reliable newsletter email system using React Email to replace the current Mailchimp hosting. This system will leverage the newly built Event Manager and follow the established patterns from the existing Newsletter web/native app.

## 📋 **Requirements Overview**

### **Core Goals**
- ✅ **Free & Self-Hosted** - Eliminate Mailchimp costs and dependencies
- ✅ **High Quality** - Professional email templates with consistent branding
- ✅ **Highly Reliable** - Robust delivery system with proper error handling
- ✅ **Event-Driven** - Integrate with the new Event Manager system
- ✅ **Curator-Friendly** - Easy Thursday evening curation workflow

### **Technical Stack**
- **Email Templates**: React Email (existing `apps/email-builder`)
- **Event Data**: New Event Manager system
- **Email Delivery**: AWS SES (existing infrastructure)
- **Scheduling**: Thursday evening curation → Friday morning send
- **Subscriber Management**: DynamoDB (existing single-table design)

## 🏗️ **System Architecture**

### **1. Newsletter Template Structure**
Based on existing `Newsletter.tsx` but enhanced with Event Manager integration:

#### **Fixed Sections (Hardcoded Patterns)**
1. **Header Section**
   - Newsletter title and date
   - Standard welcome message
   - Christadelphian greeting

2. **Upcoming Sunday Services** (This Week)
   - Memorial Service arrangements (11:00 AM)
   - Sunday School details (9:30 AM)
   - Special announcements/holidays

3. **Bible Class Section** (This Week)
   - Wednesday/Thursday Bible Class (7:30 PM Zoom)
   - Topic and leader information

4. **Next Week Preview**
   - Following Sunday arrangements
   - Next Bible Class details

5. **Standing Sections** (Always Include Until Completion)
   - **Bible Schools** - Feature prominently until event date
   - **Fraternals** - Regional gatherings
   - **Special Study Weekends** - Annual events
   - **Learn to Read the Bible Effectively** - Monday seminars

6. **Footer Section**
   - Contact information
   - Unsubscribe/preferences
   - Physical address (required by CAN-SPAM)

### **2. Event Manager Integration**

#### **Event Types to Include**
```typescript
interface NewsletterEvent {
  id: string
  title: string
  date: Date
  type: 'memorial' | 'bibleClass' | 'sundaySchool' | 'bibleSchool' | 'fraternal' | 'special' | 'news'
  status: 'draft' | 'published' | 'featured' | 'archived'
  priority: 'high' | 'medium' | 'low'
  
  // Event-specific fields
  arrangements?: MemorialArrangements
  bibleClassDetails?: BibleClassDetails
  specialDetails?: SpecialEventDetails
  newsDetails?: NewsEventDetails  // baptisms, announcements, etc.
  
  // Newsletter curation
  includeInNewsletter: boolean
  featuredUntilDate?: Date
  lastFeaturedDate?: Date
  
  // Content lifecycle rules
  displayDuration?: number  // days to show this content
  isTimeSensitive?: boolean // whether content expires based on event date
}
```

#### **Smart Event Selection Logic & Content Rules**
- **Chronological Order**: Sunday School (9:30 AM) before Memorial (11:00 AM)
- **Upcoming Events**: Next 2 weeks of regular services  
- **Featured Events**: Bible Schools, Fraternals marked as "featured until date"
- **News Events**: Variable content (baptisms, announcements) with configurable display duration
- **Content Lifecycle Rules**:
  - **Time-sensitive events**: Auto-expire after event date
  - **Announcements**: Display for configurable duration (e.g., 2 weeks)
  - **Standing events**: Featured until manually removed or "featuredUntilDate"
- **Never Repeat**: Track `lastFeaturedDate` to avoid duplicate announcements
- **Priority System**: High priority events always included, others based on space

### **3. Email & Web Newsletter Synchronization**

#### **Unified Content Strategy**
The system will maintain synchronized content between the email newsletter and web/app newsletter, ensuring consistent information while optimizing for each platform:

**Synchronized Content (Always Identical)**:
- **This Sunday**: Memorial and Sunday School arrangements
- **Next Sunday**: Following week's arrangements  
- **This Wednesday**: Bible Class details and Zoom links
- **Regular Services**: Fixed format information

**Platform-Optimized Content**:
- **Email Newsletter**: Condensed summaries with "Full Details" and "Registration" buttons linking to web
- **Web/App Newsletter**: Full event details or links to dedicated event pages
- **Event Pages**: Comprehensive information for events requiring substantial detail

#### **Content Display Rules**
```typescript
interface ContentDisplayRule {
  eventType: string
  emailFormat: 'summary' | 'full' | 'link_only'
  webFormat: 'full' | 'summary' | 'event_page_link'
  requiresEventPage: boolean
  
  // Email content limits
  emailMaxWords?: number
  emailSummaryTemplate?: string
  
  // Call-to-action buttons for email
  emailCTAs?: {
    text: string  // "Full Details", "Register Now", "Learn More"
    linkTo: 'event_page' | 'external_url' | 'newsletter_web'
  }[]
}
```

**Example Content Rules**:
- **Bible Schools**: Email summary + "Full Details" button → Dedicated event page
- **Fraternals**: Email summary + "Registration" button → Event page with registration form
- **Baptisms**: Full content in both email and web (brief announcement)
- **Bible Classes**: Full content synchronized between email and web
- **Special Announcements**: Full content if brief, summary + link if detailed

### **4. Event Page System (`/event/[slug]`)**

#### **Dynamic Event Pages**
Server-rendered pages with SEO-friendly URLs for events requiring detailed information:

**URL Structure**: `/event/cambridge-football-challenge-2025`
**Examples**:
- `/event/schoolies-mountain-study-weekend-2026`
- `/event/toronto-east-bible-school-2025`
- `/event/gta-fraternal-march-2025`

#### **Event Page Features**
```typescript
interface EventPage {
  slug: string  // SEO-friendly URL slug
  title: string
  subtitle?: string
  eventDate: Date
  registrationDeadline?: Date
  
  // Content sections
  description: string  // Rich HTML content
  schedule?: EventScheduleItem[]
  speakers?: EventSpeaker[]
  location: EventLocation
  accommodation?: AccommodationDetails
  costs?: EventCosts
  
  // Registration & Actions
  registrationEnabled: boolean
  registrationUrl?: string
  contactEmail?: string
  downloadableFiles?: EventFile[]
  
  // Newsletter integration
  emailSummary: string  // Condensed version for email
  webSummary?: string   // Summary for web newsletter
  
  // SEO & Sharing
  metaDescription: string
  socialImage?: string
  canonicalUrl: string
}
```

#### **Event Page Generation**
- **Manual Creation**: Admin interface for creating detailed event pages
- **Auto-Generation**: Create basic pages from Event Manager data
- **Template System**: Different templates for Bible Schools, Fraternals, Special Events
- **SEO Optimization**: Meta tags, structured data, canonical URLs

### **5. Curation Workflow (Thursday Evenings)**

#### **Enhanced Admin Curation Interface** (`/admin/newsletter/curate`)
1. **Unified Content Management**
   - Side-by-side preview of email and web newsletter
   - Content synchronization controls
   - Event page creation workflow

2. **Content Decision Engine**
   - **Auto-Categorization**: System suggests summary vs. full content based on event type
   - **Content Length Analysis**: Warns when email content exceeds optimal length
   - **Link Generation**: Auto-creates event page links and CTAs

3. **Curator Controls**
   - ✅ **Content Format Toggle** - Choose summary/full/link for each event
   - ✅ **Event Page Creation** - Generate dedicated pages during curation
   - ✅ **CTA Button Editor** - Customize call-to-action buttons for email
   - ✅ **Synchronization Check** - Ensure consistency between platforms
   - ✅ **Preview Both Formats** - Email and web newsletter side-by-side
   - ✅ **SEO Optimization** - Generate meta tags and social sharing images

4. **Quality Checks**
   - Validate all event page links are working
   - Check email content length limits
   - Confirm CTA buttons link to correct pages
   - Test responsive design on both platforms
   - Verify synchronization between email and web content

#### **Automated Systems & Email Queue**
- **Thursday 6 AM**: Auto-generate draft newsletter for curation
- **Thursday 9 AM**: Send QA test newsletter to admin team
- **Thursday 6 PM**: Final approval deadline for newsletter send
- **Thursday 7 PM**: Send final newsletter (if approved by 6 PM deadline)
- **Backup**: Manual send capability for urgent changes

## 🔧 **Technical Implementation Plan**

### **Phase 1: Enhanced Email Templates**
- [ ] Modernize existing `Newsletter.tsx` component
- [ ] Create responsive email design matching web app
- [ ] Add dynamic sections for different event types
- [ ] Implement proper email client compatibility testing

### **Phase 2: Event Page System (`/event/[slug]`)**
- [ ] Create dynamic event page routing system
- [ ] Build event page templates (Bible School, Fraternal, Special Event)
- [ ] Implement slug generation and SEO optimization
- [ ] Add event page creation/editing interface
- [ ] Build registration and CTA functionality

### **Phase 3: Email & Web Newsletter Synchronization**
- [ ] Create unified content management system
- [ ] Implement content display rules engine
- [ ] Build platform-specific formatting (email vs. web)
- [ ] Add content length analysis and optimization
- [ ] Create CTA button generation system

### **Phase 4: Enhanced Curation Interface**
- [ ] Build unified curation page (`/admin/newsletter/curate`)
- [ ] Implement side-by-side email/web preview
- [ ] Add content format toggle controls
- [ ] Create event page creation workflow
- [ ] Build synchronization validation system

### **Phase 5: Email Queue & Backend Service**
- [ ] Build centralized email queue management system
- [ ] Implement backend service for reliable email scheduling 
- [ ] Create hourly cron job trigger (`/api/email/queue-processor`)
- [ ] Add queue status tracking (no_jobs, queued, sending, finished)
- [ ] Build newsletter generation API endpoints
- [ ] Create scheduling system for multi-email workflow

### **Phase 6: Subscriber Management**
- [ ] Migrate existing Mailchimp subscribers
- [ ] Build subscription/unsubscription flow
- [ ] Implement email preferences system
- [ ] Add GDPR compliance features

## 🔄 **Email Queue & Backend Service Architecture**

### **Queue Management System**
Given Vercel's limited cron capabilities (only 2 cron jobs on free tier) and timing unreliability, we need a robust backend service that can handle multiple email types and ensure proper execution order.

#### **Current Email Schedule (from vercel.json)**
- **Wednesday 5 PM**: Bible Class reminder (`/api/email/bible-class`)
- **Saturday 6 PM**: Weekly recap (`/api/email/recap`)
- **NEW: Thursday 6 AM**: Auto-generate newsletter draft
- **NEW: Thursday 9 AM**: Newsletter QA test
- **NEW: Thursday 7 PM**: Newsletter send

#### **Backend Service Design**
```typescript
interface EmailQueue {
  id: string
  type: 'bible-class' | 'recap' | 'newsletter-qa' | 'newsletter-final'
  scheduledFor: Date
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
  priority: number  // 1 = highest priority
  attempts: number
  maxAttempts: number
  
  // Email content
  recipients: string[]
  template: string
  templateData: Record<string, any>
  
  // Tracking
  createdAt: Date
  processedAt?: Date
  sentAt?: Date
  error?: string
}

interface QueueStatus {
  status: 'no_jobs' | 'queued' | 'sending' | 'finished'
  currentJob?: string
  queuedJobs: number
  lastProcessed?: Date
  nextScheduled?: Date
}
```

#### **Queue Processing Logic**
**Hourly Cron Job** (`/api/email/queue-processor`):
1. **Check Queue Status** - Prevent concurrent processing
2. **Fetch Due Jobs** - Get jobs scheduled for current hour
3. **Process by Priority** - Handle highest priority jobs first
4. **Update Status** - Track progress and handle failures
5. **Error Handling** - Retry failed jobs with exponential backoff

#### **Event Stream Pattern Implementation**
```typescript
// Queue processor with event streaming capabilities
class EmailQueueProcessor {
  async processQueue(): Promise<void> {
    const status = await this.getQueueStatus()
    
    // Prevent concurrent processing
    if (status.status === 'sending') {
      console.log('Queue already processing, skipping...')
      return
    }
    
    // Get jobs due for processing
    const dueJobs = await this.getDueJobs()
    if (dueJobs.length === 0) {
      await this.setQueueStatus('no_jobs')
      return
    }
    
    // Process jobs in priority order
    await this.setQueueStatus('sending')
    for (const job of dueJobs.sort((a, b) => a.priority - b.priority)) {
      await this.processJob(job)
    }
    await this.setQueueStatus('finished')
  }
  
  async processJob(job: EmailQueue): Promise<void> {
    try {
      await this.sendEmail(job)
      await this.markJobComplete(job)
    } catch (error) {
      await this.handleJobError(job, error)
    }
  }
}
```

#### **Email Workflow Priority System**
1. **Priority 1**: Newsletter Draft Generation (Thursday 6 AM) - Must generate before QA
2. **Priority 2**: Newsletter QA (Thursday 9 AM) - Must send for review
3. **Priority 3**: Bible Class (Wednesday 5 PM) - Time-sensitive weekly reminder  
4. **Priority 4**: Newsletter Final (Thursday 7 PM) - Main weekly communication
5. **Priority 5**: Weekly Recap (Saturday 6 PM) - Summary content

#### **Reliability Features**
- **Idempotent Operations**: Jobs can be safely retried
- **Status Tracking**: Prevent duplicate sends and concurrent processing  
- **Exponential Backoff**: Retry failed jobs with increasing delays
- **Dead Letter Queue**: Handle permanently failed jobs
- **Monitoring**: Track queue health and processing times

## 📊 **Data Models**

### **Enhanced Newsletter Schema**
```typescript
interface Newsletter {
  id: string
  date: Date
  status: 'draft' | 'scheduled' | 'sent'
  
  // Platform-specific content
  emailContent: NewsletterContent
  webContent: NewsletterContent
  
  // Events with display rules
  featuredEvents: NewsletterEvent[]
  regularEvents: NewsletterEvent[]
  customContent: CustomSection[]
  
  // Publishing
  scheduledSendDate?: Date
  sentDate?: Date
  recipientCount?: number
  deliveryStats?: EmailStats
  
  // Synchronization
  lastSynchronized: Date
  contentVersion: number
  
  // Curation
  curatedBy: string
  curatedAt: Date
  approvedBy?: string
  approvedAt?: Date
}

interface NewsletterContent {
  header: NewsletterHeader
  sections: NewsletterSection[]
  footer: NewsletterFooter
  
  // Platform-specific formatting
  platform: 'email' | 'web'
  maxContentLength?: number
  includeImages: boolean
  ctaButtonsEnabled: boolean
}

interface NewsletterEvent {
  eventId: string
  
  // Display format per platform
  emailFormat: 'summary' | 'full' | 'link_only'
  webFormat: 'full' | 'summary' | 'event_page_link'
  
  // Content versions
  emailContent?: string
  webContent?: string
  emailSummary?: string
  
  // Call-to-action buttons
  emailCTAs?: CallToActionButton[]
  
  // Event page reference
  eventPageSlug?: string
  requiresEventPage: boolean
}

interface CallToActionButton {
  text: string  // "Full Details", "Register Now", "Learn More"
  url: string
  style: 'primary' | 'secondary' | 'outline'
  trackingId?: string
}
```

### **Event Page Schema**
```typescript
interface EventPage {
  id: string
  slug: string  // SEO-friendly URL slug
  title: string
  subtitle?: string
  
  // Event details
  eventId?: string  // Link to Event Manager
  eventDate: Date
  registrationDeadline?: Date
  status: 'draft' | 'published' | 'archived'
  
  // Content sections
  description: string  // Rich HTML content
  shortDescription: string  // For meta tags
  schedule?: EventScheduleItem[]
  speakers?: EventSpeaker[]
  location: EventLocation
  accommodation?: AccommodationDetails
  costs?: EventCosts
  
  // Media
  featuredImage?: string
  gallery?: string[]
  socialImage?: string
  
  // Registration & Actions
  registrationEnabled: boolean
  registrationUrl?: string
  externalRegistrationUrl?: string
  contactEmail?: string
  downloadableFiles?: EventFile[]
  
  // Newsletter integration
  emailSummary: string  // Condensed version for email
  webSummary?: string   // Summary for web newsletter
  newsletterPriority: number
  
  // SEO & Sharing
  metaDescription: string
  metaKeywords?: string[]
  canonicalUrl: string
  noIndex?: boolean
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  
  // Analytics
  pageViews?: number
  emailClicks?: number
  registrations?: number
}

interface EventScheduleItem {
  time: string
  title: string
  speaker?: string
  description?: string
  location?: string
}

interface EventSpeaker {
  name: string
  bio?: string
  photo?: string
  ecclesia?: string
}

interface EventLocation {
  name: string
  address: string
  city: string
  province: string
  postalCode: string
  country: string
  mapUrl?: string
  directions?: string
}

interface AccommodationDetails {
  available: boolean
  description?: string
  cost?: number
  contactInfo?: string
  bookingUrl?: string
}

interface EventCosts {
  registration?: number
  accommodation?: number
  meals?: number
  materials?: number
  currency: string
  notes?: string
}

interface EventFile {
  name: string
  url: string
  type: 'pdf' | 'doc' | 'image' | 'other'
  size?: number
  description?: string
}
```

### **Subscriber Schema**
```typescript
interface NewsletterSubscriber {
  email: string
  firstName?: string
  lastName?: string
  
  // Subscription status
  status: 'active' | 'unsubscribed' | 'bounced'
  subscribedAt: Date
  unsubscribedAt?: Date
  
  // Preferences
  preferences: {
    weeklyNewsletter: boolean
    eventAnnouncements: boolean
    specialEvents: boolean
  }
  
  // Compliance
  source: 'mailchimp_migration' | 'website' | 'manual'
  consentDate: Date
  ipAddress?: string
}
```

## 🎨 **Design Specifications**

### **Email Template Requirements**
- **Mobile-First**: Responsive design for all email clients
- **Brand Consistency**: Match website and app visual identity
- **Accessibility**: Proper heading hierarchy, alt text, high contrast
- **Plain Text**: Always include plain text version

### **Content Guidelines**
- **Clear Hierarchy**: Important events at top, supporting content below
- **Scannable Format**: Use headings, bullets, and white space
- **Call-to-Actions**: Clear next steps for readers
- **Contact Info**: Always include hall address and contact details

## 🚀 **Success Metrics**

### **Technical Metrics**
- **Delivery Rate**: >98% successful delivery
- **Load Time**: Email generation <2 seconds
- **Uptime**: 99.9% system availability
- **Error Rate**: <0.1% template failures

### **User Experience Metrics**
- **Curation Time**: <30 minutes Thursday evening workflow
- **Preview Accuracy**: 100% match between preview and sent email
- **Subscriber Satisfaction**: Maintain/improve engagement rates
- **Cost Savings**: $0 monthly (vs. current Mailchimp costs)

## 🔄 **Migration Strategy**

### **Phase 1: Parallel Testing**
- Build new system alongside existing Mailchimp
- Send test newsletters to small group
- Compare delivery rates and engagement

### **Phase 2: Gradual Migration**
- Import Mailchimp subscriber data
- Send newsletters from new system to 25% of subscribers
- Monitor delivery and engagement metrics

### **Phase 3: Full Cutover**
- Migrate 100% of subscribers to new system
- Cancel Mailchimp subscription
- Monitor system performance and subscriber feedback

## 🛡️ **Risk Mitigation**

### **Technical Risks**
- **Email Deliverability**: Proper SPF/DKIM/DMARC setup
- **AWS SES Limits**: Monitor sending quotas and request increases
- **Template Rendering**: Extensive testing across email clients
- **Data Loss**: Regular backups of subscriber and newsletter data

### **Operational Risks**
- **Curator Training**: Detailed documentation and training videos
- **Backup Process**: Manual send capability if automation fails
- **Emergency Contacts**: Clear escalation path for Friday morning issues
- **Rollback Plan**: Ability to quickly revert to Mailchimp if needed

## 📝 **Acceptance Criteria**

### **Must Have**
- ✅ Newsletter generation from Event Manager data
- ✅ Email & web newsletter synchronization
- ✅ Dynamic event page system (`/event/[slug]`)
- ✅ Thursday evening unified curation interface
- ✅ Thursday 7 PM automated email sending
- ✅ Mobile-responsive email templates with CTAs
- ✅ Platform-specific content optimization
- ✅ Subscriber management system
- ✅ Unsubscribe/preference management
- ✅ Email delivery analytics and click tracking

### **Should Have**
- ✅ Drag-and-drop section reordering
- ✅ Custom content editor
- ✅ A/B testing capability
- ✅ Email archive/history
- ✅ Subscriber import/export tools

### **Could Have**
- ✅ Social media integration
- ✅ Event RSVP tracking
- ✅ Personalized content based on preferences
- ✅ Integration with church calendar systems

## 📅 **Timeline Estimate**

- **Phase 1** (Email Templates): 2 weeks
- **Phase 2** (Event Page System): 3 weeks  
- **Phase 3** (Email & Web Synchronization): 3 weeks
- **Phase 4** (Enhanced Curation Interface): 3 weeks
- **Phase 5** (Email Queue & Backend Service): 2 weeks
- **Phase 6** (Subscriber Migration): 1 week

**Total Timeline**: ~14 weeks with testing and refinement

### **Priority Implementation Order**
1. **Phase 5** (Email Queue) - **HIGH PRIORITY** - Enables reliable delivery
2. **Phase 2** (Event Pages) - **MEDIUM PRIORITY** - Foundation for content linking  
3. **Phase 3** (Synchronization) - **HIGH PRIORITY** - Core functionality
4. **Phase 4** (Curation Interface) - **HIGH PRIORITY** - User workflow
5. **Phase 1** (Email Templates) - **MEDIUM PRIORITY** - Polish and optimization
6. **Phase 6** (Migration) - **LOW PRIORITY** - Final deployment step

## 🔗 **Dependencies**

- ✅ Event Manager system (already built)
- ✅ AWS SES configuration (already configured)
- ✅ DynamoDB setup (existing single-table design)
- ✅ React Email infrastructure (existing `apps/email-builder`)
- ⚠️ Email domain authentication (SPF/DKIM setup)
- ⚠️ Mailchimp export process (subscriber data)

---

**Priority**: High
**Complexity**: Medium-High  
**Impact**: High (Cost savings + improved control)
**Risk**: Medium (Email deliverability concerns)