import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SERVICE_WORKER_VERSION, isKnownServiceWorkerCacheKey } from '../src/lib/pwa-service-worker'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const registerSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/pwa/PWARegister.tsx'),
  'utf8'
)
const serviceWorkerSource = readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8')
const nextConfigSource = readFileSync(path.resolve(process.cwd(), 'next.config.ts'), 'utf8')
const loginPageSource = readFileSync(path.resolve(process.cwd(), 'src/app/login/page.tsx'), 'utf8')

run('service worker registration is limited to production and aggressively applies updates', () => {
  assert.match(registerSource, /process\.env\.NODE_ENV !== 'production'/)
  assert.match(registerSource, /recoverAuthServiceWorkerIfNeeded\(window\.location\.pathname\)/)
  assert.match(registerSource, /updateViaCache:\s*'none'/)
  assert.match(registerSource, /promoteWaitingServiceWorker/)
  assert.match(registerSource, /bindControllerChangeReload/)
  assert.match(registerSource, /registration\.update\(\)/)
})

run('service worker bypasses login, auth, and document requests', () => {
  assert.match(serviceWorkerSource, /FULL_BYPASS_PATHS = new Set\(\['\/manifest\.webmanifest', '\/sw\.js'\]\)/)
  assert.match(serviceWorkerSource, /FULL_BYPASS_PATH_PREFIXES = \['\/login', '\/signin', '\/api\/auth'\]/)
  assert.match(serviceWorkerSource, /request\.mode === 'navigate'/)
  assert.match(serviceWorkerSource, /shouldFullyBypassRequest\(url\)/)
  assert.match(serviceWorkerSource, /if \(shouldFullyBypassRequest\(url\)\) \{\s*return\s*\}/)
  assert.match(serviceWorkerSource, /event\.respondWith\(fetchNetworkOnly\(event\.request\)\)/)
})

run('old cache names are deleted on activate and known cache prefixes stay detectable', () => {
  assert.match(serviceWorkerSource, /LEGACY_CACHE_NAMES = new Set\(\['kpi-pms-v1', 'kpi-pms-static-v2'\]\)/)
  assert.match(serviceWorkerSource, /if \(isKnownCacheName\(key\)\) \{\s*return caches\.delete\(key\)/)
  assert.equal(isKnownServiceWorkerCacheKey('kpi-pms-v1'), true)
  assert.equal(isKnownServiceWorkerCacheKey('kpi-pms-static-v3'), true)
  assert.equal(isKnownServiceWorkerCacheKey('another-app-cache'), false)
})

run('safe static assets remain cacheable for PWA support', () => {
  assert.match(serviceWorkerSource, /CORE_ASSET_PATHS = new Set\(\['\/favicon\.ico', '\/icon-192\.svg', '\/icon-512\.svg'\]\)/)
  assert.match(serviceWorkerSource, /if \(!CORE_ASSET_PATHS\.has\(url\.pathname\)\) \{\s*return\s*\}/)
  assert.match(serviceWorkerSource, /caches\.open\(STATIC_CACHE_NAME\)/)
  assert.match(serviceWorkerSource, /cache\.put\(event\.request, clone\)/)
})

run('manifest stays network-only and is never used as an offline cache fallback', () => {
  assert.doesNotMatch(serviceWorkerSource, /CORE_ASSET_PATHS = new Set\(\[[^\]]*manifest\.webmanifest/)
  assert.doesNotMatch(serviceWorkerSource, /caches\.match\('\/manifest\.webmanifest'\)/)
})

run('service worker exposes a version handshake and supports skip waiting', () => {
  assert.equal(SERVICE_WORKER_VERSION, 'kpi-pms-sw-v3')
  assert.match(serviceWorkerSource, /message\.type === 'SKIP_WAITING'/)
  assert.match(serviceWorkerSource, /message\.type === 'GET_VERSION'/)
  assert.match(serviceWorkerSource, /type: 'SW_VERSION'/)
})

run('login, signin, auth callbacks, manifest, and sw script are marked safe at the framework layer', () => {
  assert.match(nextConfigSource, /source: '\/login'/)
  assert.match(nextConfigSource, /source: '\/signin'/)
  assert.match(nextConfigSource, /source: '\/api\/auth\/:path\*'/)
  assert.match(nextConfigSource, /source: '\/manifest\.webmanifest'/)
  assert.match(nextConfigSource, /source: '\/sw\.js'/)
  assert.match(nextConfigSource, /application\/manifest\+json; charset=utf-8/)
  assert.match(nextConfigSource, /no-store, no-cache, must-revalidate/)
})

run('legacy google login alert text stays out of the active login page', () => {
  assert.doesNotMatch(loginPageSource, /Google 로그인 시작에 실패했습니다\. 다시 시도해주세요\./)
})

console.log('PWA cache safety tests completed')
