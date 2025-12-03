import { ActionDef } from '../actions'

export type Clientify<T> =
  T extends ActionDef<infer Args, infer Result, any, any, any, any>
    ? (args: Args) => Promise<Result>
    : never
