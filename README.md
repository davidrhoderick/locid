# Locid Vite PoC

This repository demonstrates a working proof-of-concept for Locid — a runtime-agnostic, file-based server actions system — using a real Vite + React application.

## Project Layout

```
locid/              ← server action files
packages/
  locid/            ← @locid/vite plugin package
src/                ← frontend app
vite.config.ts      ← plugin usage
```

## How the PoC Works

1. Server action lives in `locid/hello.server.ts`.
2. Client imports it normally in `src/App.tsx`.
3. Plugin rewrites import to RPC stub.
4. Calling the function sends POST `/locid`.
5. Dev server dynamically executes the real server file.

## Running the PoC

```bash
npm install
npm run build:locid
npm run dev
```

Open http://localhost:5173 and trigger the action.

## Why This Matters

This proves Locid's core abstraction works:

> “Import server functions in the client. Let the build system turn them into RPC calls automatically.”

## Next Steps

- Streaming support
- Middleware
- Production adapters
- Type generation
