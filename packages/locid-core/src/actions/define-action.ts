import { ActionDef } from './types'

export const defineAction = <
  Args,
  Result,
  CtxIn = unknown,
  CtxOut = CtxIn,
  Req = unknown,
  Res = unknown,
>(
  def: ActionDef<Args, Result, CtxIn, CtxOut, Req, Res>,
): ActionDef<Args, Result, CtxIn, CtxOut, Req, Res> => def
