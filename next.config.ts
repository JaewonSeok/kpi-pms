import type { NextConfig } from 'next'

const AUTH_NO_STORE_HEADERS = [
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate',
  },
  {
    key: 'Pragma',
    value: 'no-cache',
  },
  {
    key: 'Expires',
    value: '0',
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/login',
        headers: AUTH_NO_STORE_HEADERS,
      },
      {
        source: '/signin',
        headers: AUTH_NO_STORE_HEADERS,
      },
      {
        source: '/api/auth/:path*',
        headers: AUTH_NO_STORE_HEADERS,
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          ...AUTH_NO_STORE_HEADERS,
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: AUTH_NO_STORE_HEADERS,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
