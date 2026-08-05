import api from '../api'

const KEY = 'company_info'

// Developer credit shown on every printed/exported document (receipts,
// invoices, ledgers, reports). Not sourced from company settings, so
// clients can't edit or remove it.
export const DEVELOPER_CREDIT_LINE1 = 'Developed by evotrade.io | Taxaccountant.pk'
export const DEVELOPER_CREDIT_LINE2 = '03395050983'

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
