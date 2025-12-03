import path from 'node:path'
import type { Plugin } from 'vite'
import { scanServerFiles } from './scan-server-files'
import { LocidFileInfo, LocidPluginOptions } from './types'

export function locidPlugin(options: LocidPluginOptions = {}): Plugin {
  const dir = options.dir ?? 'locid'
  const endpoint = options.endpoint ?? '/locid'

  let root = process.cwd()
  let isSSRBuild = false

  let fileMap = new Map<string, LocidFileInfo>()

  return {
    name: 'locid',
    enforce: 'pre',

    configResolved(config) {
      root = config.root
      isSSRBuild = !!config.build?.ssr
    },

    async buildStart() {
      fileMap = await scanServerFiles(root, dir)
      this.warn(`[locid] found ${fileMap.size} server files in ${dir}/`)
    },

    async resolveId(source, importer, opts) {
      if (isSSRBuild || opts?.ssr) return null
      if (!importer) return null

      if (!source.includes('.server')) return null

      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved) return null

      const info = fileMap.get(resolved.id)
      if (!info) return null

      const virtualId = `virtual:locid:${info.id}`
      return virtualId
    },

    load(id) {
      if (!id.startsWith('virtual:locid:')) return null

      const hashId = id.replace('virtual:locid:', '')

      return `
import { callLocid } from '@locid/vite/runtime';
export default function locidAction(args) {
  return callLocid('${hashId}', args);
}
`
    },

    configureServer(server) {
      const watcher = server.watcher
      const base = path.resolve(root, dir)

      watcher.add(base)

      const handleChange = async () => {
        console.log(`[locid] Change detected in ${dir}/ — rescanning...`)
        fileMap = await scanServerFiles(root, dir)
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      }

      watcher.on('change', (file) => {
        if (file.startsWith(base)) void handleChange()
      })

      watcher.on('add', (file) => {
        if (file.startsWith(base)) void handleChange()
      })

      watcher.on('unlink', (file) => {
        if (file.startsWith(base)) void handleChange()
      })

      server.middlewares.use(endpoint, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
          }
          const bodyStr = Buffer.concat(chunks).toString('utf8')
          const { id, args } = JSON.parse(bodyStr)

          const entry = [...fileMap.values()].find((f) => f.id === id)
          if (!entry) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: { message: 'Unknown locid id' } }))
            return
          }

          const relative =
            '/' + path.relative(root, entry.absPath).replace(/\\/g, '/')

          const mod = await server.ssrLoadModule(relative)
          const handler = mod.default

          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: { message: 'Locid file has no default export function' },
              }),
            )
            return
          }

          const result = await handler(args)

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ result }))
        } catch (err: any) {
          console.error('[locid] error handling request', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: { message: err?.message ?? 'Internal error' },
            }),
          )
        }
      })
    },
  }
}
