/**
 * The six one-digit boxes of a sign-in / registration code. Pure.
 *
 * Every box accepts a whole pasted (or autofilled) code: a full 6-digit code
 * always fills from the first box, whichever box it was pasted into. Typing
 * over a filled box keeps the new digit.
 */
export const OTP_LENGTH = 6

export function applyOtpInput(
  digits: string[],
  index: number,
  raw: string
): { digits: string[]; focus: number } | null {
  let value = raw
  if (value.length === 2 && digits[index] && value.startsWith(digits[index])) value = value.slice(1)

  if (value.length > 1) {
    const pasted = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('')
    if (pasted.length === 0) return null
    const start = pasted.length === OTP_LENGTH ? 0 : index
    const next = [...digits]
    pasted.forEach((d, i) => {
      if (start + i < OTP_LENGTH) next[start + i] = d
    })
    return { digits: next, focus: Math.min(start + pasted.length, OTP_LENGTH - 1) }
  }

  if (value && !/^\d$/.test(value)) return null
  const next = [...digits]
  next[index] = value
  return { digits: next, focus: value && index < OTP_LENGTH - 1 ? index + 1 : index }
}
