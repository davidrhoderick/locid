import { Middleware, MiddlewarePipeline } from './types'

export const createPipeline = <CtxIn, CtxOut, Req, Res>(
  ...middlewares: Middleware<any, any, Req, Res>[]
): MiddlewarePipeline<CtxIn, CtxOut, Req, Res> => ({
  async run(initialCtx: CtxIn, req: Req, res: Res): Promise<CtxOut> {
    let ctx: unknown = initialCtx

    for (const mw of middlewares) {
      const result = await mw(ctx as any, req, res)
      if (result !== undefined) {
        ctx = result
      }
    }

    return ctx as CtxOut
  },
})
