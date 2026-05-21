export const SEP = '::'

export function parseHash(h: string): { server: string; docname: string; token: string; path: string; tags: string[] } {
  const parts = h.split(SEP)
  if (parts.length < 2) throw new Error('Invalid hash format')
  const [server, docname, token, pathRaw = '', tagsStr = ''] = parts
  if (!server || !docname) throw new Error('Invalid hash format')
  const path = pathRaw.replace(/^\//, '')
  const tags = tagsStr
    ? tagsStr.split(',').map((t) => t.trim()).filter((t) => t)
    : []
  return { server, docname, token, path, tags }
}
