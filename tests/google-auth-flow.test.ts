import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildGoogleSignInRequest,
  decideGoogleAccess,
  getLoginErrorMessage,
  resolveAuthRedirect,
} from '../src/lib/auth-flow'
import { readAuthEnv, resolveAuthRuntimePolicy } from '../src/lib/auth-env'
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
  assert.match(loginPageSource, /Google Workspace로 로그인/)
  assert.match(loginPageSource, /로그인 중\.\.\./)
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

run('disallowed Google domain fails with a specific Korean error', () => {
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
      '사내 Google Workspace 계정으로만 로그인할 수 있습니다.'
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
    assert.equal(
      getLoginErrorMessage(inactiveDecision.errorCode),
      '비활성화된 계정입니다. HR 관리자에게 문의해 주세요.'
    )
  }
  if (!missingDecision.allowed) {
    assert.equal(missingDecision.errorCode, 'NotRegistered')
    assert.equal(
      getLoginErrorMessage(missingDecision.errorCode),
      'Google 계정은 확인되었지만 시스템 사용 권한이 없습니다. HR 관리자에게 문의해 주세요.'
    )
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

run('middleware redirects only fully authenticated sessions away from login and marks broken tokens as session-required', () => {
  assert.match(
    middlewareSource,
    /\(pathname\.startsWith\('\/login'\) \|\| pathname\.startsWith\('\/signin'\)\) && hasValidSessionToken/
  )
  assert.match(middlewareSource, /loginUrl\.searchParams\.set\('error', 'SessionRequired'\)/)
  assert.match(middlewareSource, /authorized: \(\) => true/)
})

run('auth runtime policy keeps dev cookies non-secure even when NEXTAUTH_URL points to https', () => {
  const policy = resolveAuthRuntimePolicy({
    NODE_ENV: 'development',
    NEXTAUTH_URL: 'https://kpi-pms.vercel.app',
  })

  assert.equal(policy.shouldTrustHost, true)
  assert.equal(policy.useSecureCookies, false)
  assert.equal(policy.sessionTokenCookieName, 'next-auth.session-token')
})

run('auth runtime policy keeps production cookies secure', () => {
  const policy = resolveAuthRuntimePolicy({
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://kpi-pms.vercel.app',
  })

  assert.equal(policy.useSecureCookies, true)
  assert.equal(policy.sessionTokenCookieName, '__Secure-next-auth.session-token')
})

run('middleware and auth options share the same auth cookie policy hooks', () => {
  assert.match(authSource, /const authRuntimePolicy = applyAuthRuntimeEnvironment\(\)/)
  assert.match(authSource, /useSecureCookies: authRuntimePolicy\.useSecureCookies/)
  assert.match(middlewareSource, /sessionTokenCookieName/)
  assert.match(middlewareSource, /sessionToken:\s*\{\s*name: authRuntimePolicy\.sessionTokenCookieName,/)
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

run('google auth flow keeps Korean login errors and detailed trace hooks', () => {
  assert.equal(
    getLoginErrorMessage('OAuthCallback'),
    'Google 인증 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  )
  assert.equal(
    getLoginErrorMessage('AccessDenied'),
    '로그인에 성공했지만 사용자 권한을 확인하지 못했습니다. 관리자에게 문의해 주세요.'
  )
  assert.match(authSource, /GOOGLE_CALLBACK_RECEIVED/)
  assert.match(authSource, /GOOGLE_PROFILE_RESOLVED/)
  assert.match(authSource, /GOOGLE_JWT_CLAIMS_APPLIED/)
  assert.match(authSource, /SESSION_RESOLUTION_FAILED/)
})

run('admin session payload is compressed before it reaches the auth cookie', () => {
  assert.match(authSource, /compressDepartmentScopeForToken/)
  assert.match(authSource, /JWT_SCOPE_COMPRESSED/)
  assert.match(authSource, /departmentAccessMode/)
  assert.match(authSource, /loadAllDepartmentIds/)
})

run('login page uses Korean admin and fallback messages', () => {
  assert.match(loginPageSource, /KPI 성과관리/)
  assert.match(loginPageSource, /관리자 계정으로 로그인\(GWS 비활성 대비\)/)
  assert.match(loginPageSource, /로그인에 실패했습니다\. 이메일과 비밀번호를 확인해 주세요\./)
  assert.match(loginPageSource, /사내 Google Workspace 계정으로만 접속 가능합니다\./)
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
