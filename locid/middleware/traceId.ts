import { type Middleware } from '@locid/vite'
import { IncomingMessage, ServerResponse } from 'node:http'
import { type PublicCtx } from '../context'

export const withTraceId: Middleware<
  PublicCtx,
  PublicCtx,
  IncomingMessage,
  ServerResponse
> = (ctx, req, _res) => {
  return {
    ...ctx,
    traceId: (req.headers['x-trace-id'] as string) ?? crypto.randomUUID(),
  }
}
