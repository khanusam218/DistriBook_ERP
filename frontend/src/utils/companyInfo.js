import api from '../api'

const KEY = 'company_info'

export async function loadCompanyInfo() {
  try {
    const res = await api.get('/company')
    localStorage.setItem(KEY, JSON.stringify(res.data))
    return res.data
  } catch {
    return getCompanyInfo()
  }
}

export function getCompanyInfo() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
