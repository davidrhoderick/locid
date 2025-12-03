import { ActionDef } from "../actions"

export interface LocidRegistryEntry<
  Args = any,
  Result = any,
  CtxIn = any,
  CtxOut = any,
  Req = any,
  Res = any
> {
  id: string
  def: ActionDef<Args, Result, CtxIn, CtxOut, Req, Res>
}