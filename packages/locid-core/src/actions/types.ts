import { MiddlewarePipeline } from '../middleware'

export interface ActionDef<
  Args,
  Result,
  CtxIn,
  CtxOut,
  Req = unknown,
  Res = unknown,
> {
  middleware?: MiddlewarePipeline<CtxIn, CtxOut, Req, Res>
  handler: (ctx: CtxOut, args: Args) => Promise<Result> | Result
}
