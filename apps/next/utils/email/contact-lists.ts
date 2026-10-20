/** The one SES contact list. Its topics are the safety nets (R5). */
export const inputTemplate = { ContactListName: 'TEEAdmin' }

// No topic readers or writers here (R5). `update-contact-list` REPLACES the
// topic list and wipes every contact's TopicPreferences (CLAUDE.md); the only
// code that edits topics is the owner-run scripts/ses-safety-net-topics.ts,
// after a full backup.
