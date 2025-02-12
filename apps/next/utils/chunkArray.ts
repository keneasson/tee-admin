export const chunkArray = <T>(array: T[], rateLimit: number): T[][] => {
  const chunksCount = Math.ceil(array.length / rateLimit)
  return [...Array(chunksCount)].map((_, index) => {
    const start = index * rateLimit
    const end = start + rateLimit
    return array.slice(start, end)
  })
}
