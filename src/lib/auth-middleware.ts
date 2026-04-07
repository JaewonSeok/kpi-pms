export const AUTH_PUBLIC_PATHS = [
  '/login',
  '/signin',
  '/403',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
]

export const AUTH_PUBLIC_PATH_PREFIXES = ['/_next', '/icons', '/api/auth']

export function isAuthPublicPath(pathname: string) {
  return (
    AUTH_PUBLIC_PATHS.includes(pathname) ||
    AUTH_PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path))
  )
}
