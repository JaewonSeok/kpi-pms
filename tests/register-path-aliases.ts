import Module from 'node:module'
import path from 'node:path'

type ResolveFilename = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
  options?: unknown
) => string

const projectRoot = path.resolve(__dirname, '..')
const moduleLoader = Module as typeof Module & {
  _resolveFilename: ResolveFilename
}
const originalResolveFilename = moduleLoader._resolveFilename

moduleLoader._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const nextRequest =
    typeof request === 'string' && request.startsWith('@/') ? path.join(projectRoot, 'src', request.slice(2)) : request

  return originalResolveFilename.call(this, nextRequest, parent, isMain, options)
}
