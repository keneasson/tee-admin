export const monthDay = (date: Date) => {
  return `${date.toLocaleString('default', {
    month: 'short',
  })} ${date.getDate()}`
}
