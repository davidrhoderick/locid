export type Middleware<CtxIn, CtxOut, Req = unknown, Res = unknown> = (
  ctx: CtxIn,
  req: Req,
  res: Res,
) => Promise<CtxOut | void> | CtxOut | void

export interface MiddlewarePipeline<
  CtxIn,
  CtxOut,
  Req = unknown,
  Res = unknown,
> {
  run: (initialCtx: CtxIn, req: Req, res: Res) => Promise<CtxOut>
}
