export enum KycReviewStatus {
  INIT = 'INIT',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
  ON_HOLD = 'ON_HOLD'
}

export enum KycReviewResult {
  NULL = 'NULL',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED'
}

export enum KycProvider {
  SUMSUB = 'SUMSUB'
}