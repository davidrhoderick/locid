import { handleRequest } from '@locid/core/server'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function createNodeHttpHandler(
  buildInitialCtx: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<unknown> | unknown,
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const result = await handleRequest(
      req,
      res,
      async (req) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        return { actionId: body.id, args: body.args }
      },
      buildInitialCtx,
    )

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ result }))
  }
}
