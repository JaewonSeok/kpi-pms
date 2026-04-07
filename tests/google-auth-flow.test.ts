import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildGoogleSignInRequest,
  decideGoogleAccess,
  getLoginErrorMessage,
  resolveAuthRedirect,
} from '../src/lib/auth-flow'
import { readAuthEnv } from '../src/lib/auth-env'
import { isAuthPublicPath } from '../src/lib/auth-middleware'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const loginPageSource = readFileSync(path.resolve(process.cwd(), 'src/app/login/page.tsx'), 'utf8')
const authSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8')
const middlewareSource = readFileSync(path.resolve(process.cwd(), 'src/middleware.ts'), 'utf8')

run('login page starts Google sign-in without redirect:false misuse', () => {
  assert.match(loginPageSource, /buildGoogleSignInRequest/)
  assert.match(loginPageSource, /await signIn\(request\.provider/)
  assert.doesNotMatch(loginPageSource, /signIn\('google'[\s\S]{0,160}redirect:\s*false/)
  assert.doesNotMatch(loginPageSource, /Google 로그인 시작에 실패했습니다\. 다시 시도해주세요\./)
})

run('allowed Google user with active employee status passes access check', () => {
  const decision = decideGoogleAccess({
    email: 'Member1@RSupport.com',
    allowedDomain: 'rsupport.com',
    employeeStatus: 'ACTIVE',
  })

  assert.equal(decision.allowed, true)
  if (decision.allowed) {
    assert.equal(decision.normalizedEmail, 'member1@rsupport.com')
  }
})

run('disallowed Google domain fails with a specific error', () => {
  const decision = decideGoogleAccess({
    email: 'member1@gmail.com',
    allowedDomain: 'rsupport.com',
    employeeStatus: 'ACTIVE',
  })

  assert.equal(decision.allowed, false)
  if (!decision.allowed) {
    assert.equal(decision.errorCode, 'InvalidDomain')
    assert.equal(
      getLoginErrorMessage(decision.errorCode),
      '사내 Google Workspace 계정으로만 로그인 가능합니다.'
    )
  }
})

run('inactive or unregistered employees fail with clear reasons', () => {
  const inactiveDecision = decideGoogleAccess({
    email: 'member1@rsupport.com',
    allowedDomain: 'rsupport.com',
    employeeStatus: 'INACTIVE',
  })
  const missingDecision = decideGoogleAccess({
    email: 'member1@rsupport.com',
    allowedDomain: 'rsupport.com',
    employeeStatus: null,
  })

  assert.equal(inactiveDecision.allowed, false)
  assert.equal(missingDecision.allowed, false)
  if (!inactiveDecision.allowed) {
    assert.equal(inactiveDecision.errorCode, 'InactiveAccount')
  }
  if (!missingDecision.allowed) {
    assert.equal(missingDecision.errorCode, 'NotRegistered')
  }
})

run('callback URL is preserved only for same-origin targets', () => {
  const defaultRequest = buildGoogleSignInRequest('https://kpi-pms.vercel.app', null)
  const internalRequest = buildGoogleSignInRequest(
    'https://kpi-pms.vercel.app',
    'https://kpi-pms.vercel.app/kpi/personal?tab=review'
  )
  const externalRequest = buildGoogleSignInRequest(
    'https://kpi-pms.vercel.app',
    'https://evil.example/phishing'
  )

  assert.equal(defaultRequest.callbackUrl, 'https://kpi-pms.vercel.app/dashboard')
  assert.equal(
    internalRequest.callbackUrl,
    'https://kpi-pms.vercel.app/kpi/personal?tab=review'
  )
  assert.equal(externalRequest.callbackUrl, 'https://kpi-pms.vercel.app/dashboard')
})

run('redirect callback resolves only relative or same-origin URLs', () => {
  assert.equal(
    resolveAuthRedirect('/kpi/org?tab=map', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/kpi/org?tab=map'
  )
  assert.equal(
    resolveAuthRedirect('https://kpi-pms.vercel.app/checkin', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/checkin'
  )
  assert.equal(
    resolveAuthRedirect('https://evil.example/checkin', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/dashboard'
  )
})

run('middleware keeps auth routes and PWA assets public while protecting app pages', () => {
  assert.equal(isAuthPublicPath('/manifest.webmanifest'), true)
  assert.equal(isAuthPublicPath('/sw.js'), true)
  assert.equal(isAuthPublicPath('/favicon.ico'), true)
  assert.equal(isAuthPublicPath('/icons/app-icon.png'), true)
  assert.equal(isAuthPublicPath('/_next/static/chunks/app.js'), true)
  assert.equal(isAuthPublicPath('/signin'), true)
  assert.equal(isAuthPublicPath('/api/auth/callback/google'), true)
  assert.equal(isAuthPublicPath('/api/auth/signin/google'), true)
  assert.equal(isAuthPublicPath('/dashboard'), false)
  assert.equal(isAuthPublicPath('/evaluation/workbench'), false)
  assert.match(
    middlewareSource,
    /matcher: \['\/\(\(\?!_next\|favicon\.ico\|manifest\.webmanifest\|sw\.js\|icons\|login\|signin\|403\|api\/auth\)\.\*\)'\]/
  )
})

run('authenticated users are redirected away from both login entry points', () => {
  assert.match(
    middlewareSource,
    /\(pathname\.startsWith\('\/login'\) \|\| pathname\.startsWith\('\/signin'\)\) && token/
  )
})

run('manifest requests stay outside the signin redirect path', () => {
  assert.equal(isAuthPublicPath('/manifest.webmanifest'), true)
  assert.match(middlewareSource, /if \(isAuthPublicPath\(pathname\)\)/)
  assert.match(middlewareSource, /if \(!token\) \{\s*return NextResponse\.redirect\(new URL\('\/login', req\.url\)\)/)
})

run('auth employee lookup uses a minimal select instead of loading the full employee row', () => {
  assert.match(authSource, /const authEmployeeSelect = \{/)
  assert.match(authSource, /select: authEmployeeSelect/)
  assert.doesNotMatch(authSource, /include:\s*\{\s*department:\s*true\s*\}/)
  assert.doesNotMatch(authSource, /jobTitle:\s*true/)
  assert.doesNotMatch(authSource, /teamName:\s*true/)
  assert.doesNotMatch(authSource, /resignationDate:\s*true/)
  assert.doesNotMatch(authSource, /sortOrder:\s*true/)
  assert.doesNotMatch(authSource, /notes:\s*true/)
})

run('login error messages stay specific for callback and access failures', () => {
  assert.equal(
    getLoginErrorMessage('OAuthCallback'),
    'Google 인증 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
  )
  assert.equal(
    getLoginErrorMessage('AccessDenied'),
    '로그인이 허용되지 않은 계정입니다. 사내 계정과 권한을 확인해주세요.'
  )
})

run('auth env reader accepts NEXTAUTH and AUTH aliases safely', () => {
  const nextAuthConfig = readAuthEnv({
    NEXTAUTH_URL: 'https://kpi-pms.vercel.app',
    NEXTAUTH_SECRET: 'super-secret-value',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    ALLOWED_DOMAIN: 'RSupport.com',
  })
  const authAliasConfig = readAuthEnv({
    AUTH_URL: 'https://kpi-pms.vercel.app',
    AUTH_SECRET: 'another-secret-value',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    ALLOWED_DOMAIN: '@rsupport.com',
  })

  assert.equal(nextAuthConfig.baseUrl, 'https://kpi-pms.vercel.app')
  assert.equal(nextAuthConfig.secretSource, 'NEXTAUTH_SECRET')
  assert.equal(authAliasConfig.baseUrlSource, 'AUTH_URL')
  assert.equal(authAliasConfig.allowedDomain, 'rsupport.com')
})

console.log('Google auth flow tests completed')
