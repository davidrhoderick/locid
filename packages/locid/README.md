# @locid/vite

Locid is a framework-agnostic “server actions” system inspired by Next.js server actions, but portable across **any** JavaScript runtime (Vite, Bun, Deno, Node, Workers).  
This package (`@locid/vite`) provides the Vite integration layer that makes Locid work during development and client-side bundling.

Locid turns files in a **server directory** into RPC-style functions that you can import and call from your frontend code as if they were local. At build time, the plugin rewrites those imports to lightweight stubs that call your server action over HTTP (with optional streaming in the future).

---

## How Locid Works (Conceptual)

1. You place server-side functions inside a directory such as `locid/`, and name them with the `.server.ts` suffix:

   ```ts
   // locid/hello.server.ts
   export default async function helloServer(args: { name: string }) {
     return {
       message: `Hello from Locid, ${args.name}!`,
       timestamp: new Date().toISOString(),
     }
   }
   ```

2. The Vite plugin scans that folder during build and assigns each file a stable hashed ID based on its relative path.
(Example: "hello.server.ts" → "9a3f12d01a44").

3. When the client imports a .server.ts file:

 - In SSR or server builds, the import resolves normally.
 - In client builds, the plugin rewrites the import into a virtual module:

   ```ts
   import { callLocid } from "@locid/vite/runtime";
   export default function locidAction(args) {
     return callLocid("HASH_ID", args);
   }
   ```

4. When that function is called in the browser, callLocid sends a POST request to the Locid endpoint (/locid by default).

5. During development, the plugin registers a dev-server route that dynamically imports your server function file and executes it.

6. You get a zero-API, file-based RPC system—server actions without a framework.

---

## Installation

In a Vite project using npm workspaces:

```bash
npm install @locid/vite --save-dev
```

---

## Usage

1. Create a directory for server actions

   Create `locid/hello.server.ts`:

   ```ts
   export default async function helloServer({ name }: { name: string }) {
     return { message: `Hello from ${name}` }
   }
   ```

2. Add the plugin to `vite.config.ts`:

   ```ts
   import { defineConfig } from 'vite'
   import { locidPlugin } from '@locid/vite'

   export default defineConfig({
     plugins: [
       locidPlugin(),
       // ...other plugins
     ],
   })
   ```

3. Call server actions from the client

   ```ts
   import helloServer from './locid/hello.server'

   const result = await helloServer({ name: 'Dave' })
   console.log(result)
   ```

---

## Configuration

|Option|Type|Description|
|---|---|---|
|dir|string|The directory where server actions are located. Defaults to `locid`.|
|endpoint|string|The endpoint where server actions are called. Defaults to `/locid`.|

```ts
export default defineConfig({
  plugins: [
    locidPlugin({
      dir: 'actions',
      endpoint: '/actions',
    }),
    // ...other plugins
  ],
})
```

---

## Runtime Options

`@locid/vite` exposes runtime helpers:

```ts
import { configureLocidClient } from "@locid/vite/runtime";

configureLocidClient({
  endpoint: "/api/locid",
  getAuthToken: async () => localStorage.getItem("token")!,
});
```

---

## How the Vite Plugin Works (Implementation Outline)


1. Scan server directory
   Finds all *.server.{ts,tsx,js,mjs,cjs} files and builds a map of:
   `{ id: <hash>, absPath, relPath }`.

2. Intercept imports
   When the client tries to import a .server file, rewrite it to
   `virtual:locid:<hash>`.

3. Load the virtual module
   Returns a tiny stub that calls `callLocid(hash, args)`.

4. Dev server middleware
   Handles POST `/locid`, dynamically imports the real file, runs it, and returns the JSON result.

This gives the developer:

- Zero config
- Zero API boilerplate
- A "server action" experience compatible with the entire JS ecosystem.

---

### Status

This is an early proof-of-concept (PoC).
Planned features include:

- Named exports support
- Streaming (NDJSON / fetch streams)
- Middleware support
- Caching & invalidation
- Infrastructure adapters (Deno, AWS Lambda, Cloudflare Workers, Bun, etc.)