/**
 * Pure ordering helpers for the email list. Kept free of any Tamagui/React
 * imports so it can be unit-tested in a plain node env.
 *
 * The model behind "Set as preferred": the preferred address is simply the
 * item at index 0. Moving an address to the front and replacing the whole
 * ordered set (PUT /api/user/emails) is how preference is persisted.
 */
export function moveEmailToFront<T extends { id: string }>(list: T[], id: string): T[] {
  const idx = list.findIndex((e) => e.id === id)
  if (idx <= 0) return list.slice()
  const next = list.slice()
  const [moved] = next.splice(idx, 1)
  next.unshift(moved)
  return next
}
