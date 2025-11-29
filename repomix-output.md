This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
locid/
  hello.server.ts
packages/
  locid/
    src/
      index.ts
      plugin.ts
      runtime.ts
    package.json
    tsconfig.json
public/
  vite.svg
src/
  App.tsx
  main.tsx
.gitignore
.prettierrc
eslint.config.js
index.html
package.json
README.md
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
```

# Files

## File: locid/hello.server.ts
````typescript
export default async function helloServer(args: { name: string }) {
  return {
    message: `Hello from Locid, ${args.name}!`,
    timestamp: new Date().toISOString(),
  }
}
````

## File: packages/locid/src/index.ts
````typescript
export { locidPlugin } from './plugin.js';
export { callLocid, configureLocidClient } from './runtime.js';
````

## File: packages/locid/src/plugin.ts
````typescript
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
````

## File: packages/locid/src/runtime.ts
````typescript
export type LocidClientOptions = {
  endpoint?: string;
  getAuthToken?: () => string | Promise<string>;
};

let globalOptions: LocidClientOptions = {
  endpoint: '/locid',
};

export function configureLocidClient(opts: LocidClientOptions) {
  globalOptions = { ...globalOptions, ...opts };
}

export async function callLocid<TArgs = unknown, TResult = unknown>(
  locid: string,
  args: TArgs,
): Promise<TResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (globalOptions.getAuthToken) {
    const token = await globalOptions.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(globalOptions.endpoint ?? '/locid', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: locid, args }),
  });

  if (!res.ok) {
    throw new Error(`Locid call failed with status ${res.status}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message ?? 'Locid error');
  }

  return json.result as TResult;
}
````

## File: packages/locid/package.json
````json
{
  "name": "@locid/vite",
  "version": "0.0.1",
  "description": "",
  "license": "ISC",
  "author": "",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./runtime": {
      "import": "./dist/runtime.js",
      "types": "./dist/runtime.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "fast-glob": "^3.3.2"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "typescript": "^5.0.0"
  }
}
````

## File: packages/locid/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": [
      "node"
    ]
  },
  "include": [
    "src"
  ]
}
````

## File: public/vite.svg
````
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>
````

## File: src/App.tsx
````typescript
import { useState } from 'react'

// This import will be rewritten on client builds into a stub that calls /locid
import helloServer from '../locid/hello.server'

export default function App() {
  const [result, setResult] = useState<string | null>(null)

  const handleClick = async () => {
    const res = await helloServer({ name: 'Dave' })
    setResult(res.message)
  }

  return (
    <div>
      <h1>Locid PoC</h1>
      <button onClick={handleClick}>Call server action</button>
      {result && <p>{result}</p>}
    </div>
  )
}
````

## File: src/main.tsx
````typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
````

## File: .gitignore
````
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
````

## File: .prettierrc
````
{
  "semi": false,
  "singleQuote": true
}
````

## File: eslint.config.js
````javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier-recommended'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
````

## File: index.html
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>locid-vite-poc</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## File: package.json
````json
{
  "name": "locid-vite-poc",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "repomix": "repomix --style markdown",
    "build:locid": "npm run build -w packages/locid"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@locid/vite": "^0.0.1",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "prettier": "3.7.2",
    "repomix": "^1.9.2",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.46.4",
    "vite": "^7.2.4"
  }
}
````

## File: README.md
````markdown
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
````

## File: tsconfig.app.json
````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
````

## File: tsconfig.json
````json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
````

## File: tsconfig.node.json
````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
````

## File: vite.config.ts
````typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { locidPlugin } from '@locid/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    locidPlugin({
      dir: 'locid', // where your server actions live
      endpoint: '/locid',
    }),
  ],
})
````
