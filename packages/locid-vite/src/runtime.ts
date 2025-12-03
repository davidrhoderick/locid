import { type LocidClientOptions } from './types'

let globalOptions: LocidClientOptions = {
  endpoint: '/locid',
}

export function configureLocidClient(opts: LocidClientOptions) {
  globalOptions = { ...globalOptions, ...opts }
}

export async function callLocid<TArgs = unknown, TResult = unknown>(
  locid: string,
  args: TArgs,
): Promise<TResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const res = await fetch(globalOptions.endpoint ?? '/locid', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: locid, args }),
  })

  if (!res.ok) throw new Error(`Locid call failed with status ${res.status}`)

  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? 'Locid error')

  return json.result as TResult
}
