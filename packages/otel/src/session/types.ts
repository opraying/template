export type SessionId = string

export type SessionState = {
  expiresAt?: number
  id: SessionId
  startTime: number
}
