import { defineAction } from '@locid/core'
import { publicPipeline } from './middleware/pipelines'
import { PublicCtx } from './context'

const ping = defineAction({
  middleware: publicPipeline,
  async handler(ctx: PublicCtx, _args: {}) {
    return { ok: true, traceId: ctx.traceId }
  },
})

export default ping
