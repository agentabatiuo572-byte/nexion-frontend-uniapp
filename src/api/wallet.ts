import { request } from '@/utils/http'
import type { PageResult, WalletLedger } from '@/types/wallet'

export interface WalletLedgerQuery {
  userId?: number | string
  direction?: 'IN' | 'OUT'
  pageNum?: number
  pageSize?: number
}

export function getWalletLedgers(params: WalletLedgerQuery) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })

  return request<PageResult<WalletLedger>>({
    url: `/wallet/ledgers?${query.toString()}`
  })
}

