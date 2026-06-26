export const isValidEmail = (val) => {
  if (!val || !val.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
}

export const isValidPhone = (val) => {
  if (!val || !val.trim()) return true
  const digits = val.replace(/[\s\-()+]/g, '')
  return /^\d{7,15}$/.test(digits)
}
