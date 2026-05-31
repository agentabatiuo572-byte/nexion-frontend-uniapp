export interface PageResult<T> {
  records: T[]
  total: number
  size?: number
  current?: number
}

export interface WalletLedger {
  id: number
  userId: number
  bizNo: string
  bizType: string
  asset: string
  direction: string
  amount: number | string
  balanceAfter?: number | string
  status: string
  remark?: string
  createdAt?: string
}

