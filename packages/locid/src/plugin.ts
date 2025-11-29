import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import crypto from 'node:crypto';
import type { Plugin } from 'vite';

type LocidFileInfo = {
  id: string;
  absPath: string;
  relPath: string;
};

type LocidPluginOptions = {
  dir?: string;      // e.g. "locid"
  endpoint?: string; // e.g. "/locid"
};

export function locidPlugin(options: LocidPluginOptions = {}): Plugin {
  const dir = options.dir ?? 'locid';
  const endpoint = options.endpoint ?? '/locid';

  const fileMap = new Map<string, LocidFileInfo>();
  let root = process.cwd();
  let isSSRBuild = false;

  return {
    name: 'locid',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      isSSRBuild = !!config.build?.ssr;
    },

    async buildStart() {
      const base = path.resolve(root, dir);
      const pattern = path
        .join(base, '**/*.server.{ts,tsx,js,jsx,mjs,cjs}')
        .replace(/\\/g, '/');

      const entries = await fg(pattern, { absolute: true });

      fileMap.clear();

      for (const absPath of entries) {
        const relPath = path.relative(base, absPath).replace(/\\/g, '/');

        const hash = crypto
          .createHash('sha1')
          .update(relPath)
          .digest('hex')
          .slice(0, 12);

        fileMap.set(absPath, {
          id: hash,
          absPath,
          relPath,
        });
      }

      this.warn(`[locid] found ${fileMap.size} server files in ${dir}/`);
    },

    async resolveId(source, importer, opts) {
      if (isSSRBuild || opts?.ssr) return null;
      if (!importer) return null;

      if (!source.includes('.server')) return null;

      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved) return null;

      const info = fileMap.get(resolved.id);
      if (!info) return null;

      const virtualId = `virtual:locid:${info.id}`;
      return virtualId;
    },

    load(id) {
      if (!id.startsWith('virtual:locid:')) return null;

      const hashId = id.replace('virtual:locid:', '');

      // Import from @locid/vite/runtime (as per exports map)
      return `
        import { callLocid } from '@locid/vite/runtime';
        export default function locidAction(args) {
          return callLocid('${hashId}', args);
        }
      `;
    },

    configureServer(server) {
      // Dev-only backend inside Vite dev server
      server.middlewares.use(endpoint, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          const { id, args } = JSON.parse(bodyStr);

          const entry = [...fileMap.values()].find((f) => f.id === id);
          if (!entry) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { message: 'Unknown locid id' } }));
            return;
          }

          const mod = await import(entry.absPath);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: { message: 'Locid file has no default export function' },
              }),
            );
            return;
          }

          const result = await handler(args);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ result }));
        } catch (err: any) {
          console.error('[locid] error handling request', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: { message: err?.message ?? 'Internal error' },
            }),
          );
        }
      });
    },
  };
}