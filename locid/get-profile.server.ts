import { defineAction } from '@locid/vite'
import { type AuthedCtx } from './context'
import { authedPipeline } from './middleware/pipelines'

const getProfile = defineAction({
  middleware: authedPipeline,
  async handler(ctx: AuthedCtx, _args: {}) {
    return ctx.userId
  },
})

export default getProfile
