import { LocidRegistryEntry } from './types'

const registry = new Map<string, LocidRegistryEntry>()

export function registerAction(entry: LocidRegistryEntry) {
  registry.set(entry.id, entry)
}

export async function handleRequest<Req, Res>(
  req: Req,
  res: Res,
  parseRpc: (req: Req) => Promise<{ actionId: string; args: unknown }>,
  buildInitialCtx: (req: Req, res: Res) => Promise<unknown> | unknown,
): Promise<unknown> {
  const { actionId, args } = await parseRpc(req)
  const entry = registry.get(actionId)

  if (!entry) throw new Error(`Unknown action: ${actionId}`)

  const { def } = entry as LocidRegistryEntry
  const initialCtx = await buildInitialCtx(req, res)

  let finalCtx: unknown = initialCtx
  if (def.middleware) {
    finalCtx = await def.middleware.run(initialCtx, req, res)
  }

  return def.handler(finalCtx as any, args as any)
}
