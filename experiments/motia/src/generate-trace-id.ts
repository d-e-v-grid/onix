export const generateCode = (length = 6) => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const generateTraceId = () => {
  const datePart = String(Date.now()).slice(6)
  const randomPart = generateCode(5)
  return `${randomPart}-${datePart}`
}
