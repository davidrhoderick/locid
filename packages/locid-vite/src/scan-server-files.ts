import path from 'node:path'
import crypto from 'node:crypto'
import { LocidFileInfo } from './types'
import FastGlob from 'fast-glob'

export const scanServerFiles = async (root: string, dir: string) => {
  const base = path.resolve(root, dir)
  const pattern = path
    .join(base, '**/*.server.{ts,tsx,js,jsx,mjs,cjs}')
    .replace(/\\/g, '/')

  const entries = await FastGlob(pattern, { absolute: true })

  const newMap = new Map<string, LocidFileInfo>()

  for (const absPath of entries) {
    const relPath = path.relative(base, absPath).replace(/\\/g, '/')

    const hash = crypto
      .createHash('sha1')
      .update(relPath)
      .digest('hex')
      .slice(0, 12)

    newMap.set(absPath, {
      id: hash,
      absPath,
      relPath,
    })
  }

  return newMap
}
