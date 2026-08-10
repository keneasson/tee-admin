/**
 * Pure ordering helper for the phone list. Kept free of any Tamagui/React
 * imports so it can be unit-tested in a plain node env.
 *
 * The model behind "Set as preferred": the preferred number is simply the item
 * at index 0. Moving a number to the front and replacing the whole ordered set
 * (PUT /api/user/phones) is how preference is persisted.
 */
import { moveEmailToFront } from './email-ordering'

export function movePhoneToFront<T extends { id: string }>(list: T[], id: string): T[] {
  return moveEmailToFront(list, id)
}
