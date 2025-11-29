export type LocidFileInfo = {
  id: string
  absPath: string
  relPath: string
}

export type LocidPluginOptions = {
  dir?: string // e.g. "locid"
  endpoint?: string // e.g. "/locid"
}
