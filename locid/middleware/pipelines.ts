import type { PublicCtx, AuthedCtx } from '../context'
import { withOptionalUser, requireUser } from './auth'
import { createPipeline } from '@locid/core'
import { withTraceId } from './traceId'
import { IncomingMessage, ServerResponse } from 'node:http'

// context in: PublicCtx, context out: AuthedCtx
export const authedPipeline = createPipeline<
  PublicCtx,
  AuthedCtx,
  IncomingMessage,
  ServerResponse
>(withTraceId, withOptionalUser, requireUser)

// pure public: same ctx in/out
export const publicPipeline = createPipeline<
  PublicCtx,
  PublicCtx,
  IncomingMessage,
  ServerResponse
>(withTraceId)
