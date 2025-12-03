export type PublicCtx = {
  traceId: string
}

export type AuthedCtx = PublicCtx & {
  userId: string
}
