export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunksCount = Math.ceil(array.length / size)
  return [...Array(chunksCount)].map((_, index) => {
    const start = index * chunksCount
    const end = start + size
    return array.slice(start, end)
  })
}
