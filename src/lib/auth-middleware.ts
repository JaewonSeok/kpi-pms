export const AUTH_PUBLIC_PATH_PREFIXES = ['/login', '/403', '/api/auth']

export function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path))
}
