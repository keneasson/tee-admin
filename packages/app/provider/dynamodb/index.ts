// Main exports for DynamoDB data layer - 2 Table Design
export * from './config'
export * from './types'
export * from './repositories/schedule-repository'
export * from './repositories/admin-repository'
export * from './repositories/person-repository'
export * from './repositories/post-repository'
export * from './repositories/mailing-list-repository'
export * from './table-definitions'

// Repository instances (singletons)
import { ScheduleRepository } from './repositories/schedule-repository'
import { AdminRepository } from './repositories/admin-repository'
import { PersonRepository } from './repositories/person-repository'
import { PostRepository } from './repositories/post-repository'

// Export repository instances
export const scheduleRepo = new ScheduleRepository()
export const adminRepo = new AdminRepository()
export const personRepo = new PersonRepository()
export const postRepo = new PostRepository()

// Convenience methods for common operations
export const DynamoDataLayer = {
  // Schedule operations (consolidated schedules + events)
  schedules: {
    getByEcclesiaAndDateRange: scheduleRepo.getSchedulesByEcclesiaAndDateRange.bind(scheduleRepo),
    getAllByDateRange: scheduleRepo.getAllSchedulesByDateRange.bind(scheduleRepo),
    getForNewsletter: scheduleRepo.getSchedulesForNewsletter.bind(scheduleRepo), // NEWSLETTER OPTIMIZATION
    getLatest: scheduleRepo.getLatestSchedules.bind(scheduleRepo),
    getByType: scheduleRepo.getSchedulesByTypeAndDateRange.bind(scheduleRepo),
    replaceSheet: scheduleRepo.replaceSheetSchedules.bind(scheduleRepo),
  },

  // Member operations (profile + directory in tee-admin table)
  members: {
    getMemberData: adminRepo.getMemberData.bind(adminRepo), // Combined profile + directory
    getMembersByEcclesia: adminRepo.getMembersByEcclesia.bind(adminRepo),
    searchByName: adminRepo.searchMembersByName.bind(adminRepo),
    getDirectoryRecord: adminRepo.getDirectoryRecord.bind(adminRepo),
    replaceSheetDirectory: adminRepo.replaceSheetDirectoryRecords.bind(adminRepo),
  },

  // Events operations (part of schedules table now)
  events: {
    getEvent: scheduleRepo.getEvent.bind(scheduleRepo),
    createEvent: scheduleRepo.createEventRecord.bind(scheduleRepo),
    updateEvent: scheduleRepo.updateEventData.bind(scheduleRepo),
    deleteEvent: scheduleRepo.deleteEvent.bind(scheduleRepo),
  },

  // Person operations (UUID-based identity - Unified People System)
  persons: {
    getById: personRepo.getById.bind(personRepo),
    getByEmail: personRepo.getByEmail.bind(personRepo),
    listByEcclesia: personRepo.listByEcclesia.bind(personRepo),
    searchByName: personRepo.searchByName.bind(personRepo),
    create: personRepo.create.bind(personRepo),
    getProfileWithPrivacy: personRepo.getProfileWithPrivacy.bind(personRepo),
  },

  // Repository instances for advanced operations
  repos: {
    schedule: scheduleRepo, // Consolidated schedules + events
    admin: adminRepo,       // Enhanced tee-admin table
    person: personRepo,     // UUID-based person identity
  },
}