import type { Middleware } from '@locid/vite'
import type { PublicCtx, AuthedCtx } from '../context'
import { IncomingMessage, ServerResponse } from 'node:http'

export const withOptionalUser: Middleware<
  PublicCtx,
  PublicCtx & { userId?: string },
  IncomingMessage,
  ServerResponse
> = (ctx, req) => {
  const token = req.headers.authorization ?? ''
  const userId = token ? '1' : undefined
  return { ...ctx, userId }
}

export const requireUser: Middleware<
  PublicCtx & { userId?: string },
  AuthedCtx,
  IncomingMessage,
  ServerResponse
> = (ctx) => {
  if (!ctx.userId) {
    throw new Error('Unauthorized')
  }
  // we assert it as non-optional now:
  return { ...ctx, userId: ctx.userId }
}
