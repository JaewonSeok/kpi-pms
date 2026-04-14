import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildGoogleSignInRequest,
  decideGoogleAccess,
  getLoginErrorMessage,
  resolveLoginFeedback,
  resolveAuthRedirect,
} from '../src/lib/auth-flow'
import {
  buildAuthCookieNameCandidates,
  buildAuthCookiePolicy,
  extractSetCookieNames,
  readAuthEnv,
  resolveAuthRequestDiagnostics,
  resolveAuthRuntimePolicy,
  summarizeSessionPayload,
} from '../src/lib/auth-env'
import { isAuthPublicPath, resolveMiddlewareAccessDecision } from '../src/lib/auth-middleware'

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
const nextAuthRouteSource = readFileSync(
  path.resolve(process.cwd(), 'src/app/api/auth/[...nextauth]/route.ts'),
  'utf8'
)
const dashboardPageSource = readFileSync(
  path.resolve(process.cwd(), 'src/app/(main)/dashboard/page.tsx'),
  'utf8'
)
const mainLayoutSource = readFileSync(
  path.resolve(process.cwd(), 'src/app/(main)/layout.tsx'),
  'utf8'
)
const protectedPageHelperSource = readFileSync(
  path.resolve(process.cwd(), 'src/server/auth/protected-page.ts'),
  'utf8'
)
const accessPendingPageSource = readFileSync(
  path.resolve(process.cwd(), 'src/app/access-pending/page.tsx'),
  'utf8'
)

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

run('callback URL is preserved only for same-origin targets and never returns to login', () => {
  const defaultRequest = buildGoogleSignInRequest('https://kpi-pms.vercel.app', null)
  const internalRequest = buildGoogleSignInRequest(
    'https://kpi-pms.vercel.app',
    'https://kpi-pms.vercel.app/kpi/personal?tab=review'
  )
  const loginLoopRequest = buildGoogleSignInRequest(
    'https://kpi-pms.vercel.app',
    'https://kpi-pms.vercel.app/login?callbackUrl=%2Fdashboard'
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
  assert.equal(loginLoopRequest.callbackUrl, 'https://kpi-pms.vercel.app/dashboard')
  assert.equal(externalRequest.callbackUrl, 'https://kpi-pms.vercel.app/dashboard')
})

run('redirect callback resolves only relative or same-origin URLs and avoids login loop callbacks', () => {
  assert.equal(
    resolveAuthRedirect('/kpi/org?tab=map', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/kpi/org?tab=map'
  )
  assert.equal(
    resolveAuthRedirect('https://kpi-pms.vercel.app/checkin', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/checkin'
  )
  assert.equal(
    resolveAuthRedirect('https://kpi-pms.vercel.app/login', 'https://kpi-pms.vercel.app'),
    'https://kpi-pms.vercel.app/dashboard'
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
  assert.equal(isAuthPublicPath('/access-pending'), true)
  assert.equal(isAuthPublicPath('/icons/app-icon.png'), true)
  assert.equal(isAuthPublicPath('/_next/static/chunks/app.js'), true)
  assert.equal(isAuthPublicPath('/signin'), true)
  assert.equal(isAuthPublicPath('/api/auth/callback/google'), true)
  assert.equal(isAuthPublicPath('/api/auth/signin/google'), true)
  assert.equal(isAuthPublicPath('/manifest.json'), true)
  assert.equal(isAuthPublicPath('/styles/app.css'), true)
  assert.equal(isAuthPublicPath('/dashboard'), false)
  assert.equal(isAuthPublicPath('/evaluation/workbench'), false)
  assert.match(middlewareSource, /_next\/static\|_next\/image/)
})

run('middleware allows recoverable callback tokens to pass the first protected request', () => {
  assert.match(middlewareSource, /hasRecoverableAuthTokenIdentity/)
  assert.match(middlewareSource, /resolveMiddlewareAccessDecision/)
  assert.match(middlewareSource, /resolveRequestAuthToken/)
  assert.match(middlewareSource, /AUTH_CLAIMS_PENDING_REDIRECT/)
  assert.match(middlewareSource, /matchedSessionCookieName/)
  assert.match(middlewareSource, /presentSessionCookieNames/)
  assert.match(middlewareSource, /MIDDLEWARE_SESSION_ACCEPTED/)
  assert.match(middlewareSource, /MIDDLEWARE_SESSION_REJECTED/)
  assert.match(middlewareSource, /LOGIN_REDIRECT_TRIGGERED/)
})

run('middleware decision helper distinguishes missing, partial, authorized, and login escape states', () => {
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/dashboard',
      tokenPresent: false,
      hasCoreClaims: false,
      hasRecoverableIdentity: false,
    }),
    {
      action: 'redirect-login',
      reason: 'TOKEN_MISSING',
    }
  )
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/login',
      tokenPresent: true,
      hasCoreClaims: false,
      hasRecoverableIdentity: true,
      claimsPending: true,
    }),
    {
      action: 'redirect-pending',
      reason: 'AUTHENTICATED_BUT_CLAIMS_MISSING',
    }
  )
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/dashboard',
      tokenPresent: true,
      hasCoreClaims: false,
      hasRecoverableIdentity: true,
      claimsPending: true,
    }),
    {
      action: 'redirect-pending',
      reason: 'AUTHENTICATED_BUT_CLAIMS_MISSING',
    }
  )
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/dashboard',
      tokenPresent: true,
      hasCoreClaims: false,
      hasRecoverableIdentity: true,
    }),
    {
      action: 'allow',
      reason: 'PARTIAL_TOKEN_REHYDRATE',
    }
  )
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/dashboard',
      tokenPresent: true,
      hasCoreClaims: true,
      hasRecoverableIdentity: true,
      menuAuthorized: false,
    }),
    {
      action: 'redirect-403',
      reason: 'UNAUTHORIZED_MENU',
    }
  )
  assert.deepEqual(
    resolveMiddlewareAccessDecision({
      pathname: '/login',
      tokenPresent: true,
      hasCoreClaims: true,
      hasRecoverableIdentity: true,
    }),
    {
      action: 'redirect-dashboard',
      reason: 'LOGIN_ALREADY_AUTHENTICATED',
    }
  )
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

run('auth runtime policy keeps production cookies secure and yields a shared cookie source of truth', () => {
  const policy = resolveAuthRuntimePolicy({
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://kpi-pms.vercel.app',
  })
  const cookies = buildAuthCookiePolicy(policy)

  assert.equal(policy.useSecureCookies, true)
  assert.equal(policy.sessionTokenCookieName, '__Secure-next-auth.session-token')
  assert.equal(cookies.sessionToken.name, '__Secure-next-auth.session-token')
  assert.equal(cookies.callbackUrl.name, '__Secure-next-auth.callback-url')
  assert.equal(cookies.csrfToken.name, '__Host-next-auth.csrf-token')
  assert.equal(cookies.sessionToken.options.sameSite, 'lax')
  assert.equal(cookies.sessionToken.options.path, '/')
})

run('auth runtime diagnostics expose secure/plain candidates and forwarded host context', () => {
  const candidates = buildAuthCookieNameCandidates()
  const previewDiagnostics = resolveAuthRequestDiagnostics(
    {
      headers: new Headers({
        host: 'kpi-pms-git-feature-rsupport.vercel.app',
        'x-forwarded-host': 'kpi-pms.vercel.app',
        'x-forwarded-proto': 'https',
      }),
      url: 'https://kpi-pms-git-feature-rsupport.vercel.app/api/auth/callback/google',
    },
    {
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    }
  )
  const localhostDiagnostics = resolveAuthRequestDiagnostics(
    {
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
      }),
      url: 'http://localhost:3000/login',
    },
    {
      NODE_ENV: 'development',
    }
  )

  assert.deepEqual(candidates.sessionToken, [
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
  ])
  assert.deepEqual(candidates.callbackUrl, [
    '__Secure-next-auth.callback-url',
    'next-auth.callback-url',
  ])
  assert.equal(previewDiagnostics.host, 'kpi-pms-git-feature-rsupport.vercel.app')
  assert.equal(previewDiagnostics.forwardedHost, 'kpi-pms.vercel.app')
  assert.equal(previewDiagnostics.forwardedProto, 'https')
  assert.equal(previewDiagnostics.originCandidate, 'https://kpi-pms.vercel.app')
  assert.equal(previewDiagnostics.vercelEnv, 'preview')
  assert.equal(localhostDiagnostics.originCandidate, 'http://localhost:3000')
})

run('middleware and auth options share the same auth cookie policy hooks', () => {
  assert.match(authSource, /const authRuntimePolicy = applyAuthRuntimeEnvironment\(\)/)
  assert.match(authSource, /const authCookiePolicy = buildAuthCookiePolicy\(authRuntimePolicy\)/)
  assert.match(authSource, /cookies: authCookiePolicy/)
  assert.match(middlewareSource, /buildAuthCookieNameCandidates/)
  assert.match(middlewareSource, /resolveRequestAuthToken/)
})

run('google auth flow keeps Korean login errors and detailed trace hooks', () => {
  if (getLoginErrorMessage('AuthenticatedButClaimsMissing') === null) {
    assert.equal(getLoginErrorMessage('AuthenticatedButClaimsMissing'), null)
    assert.equal(getLoginErrorMessage('CLAIMS_REHYDRATION_FAILED'), null)
    assert.equal(typeof getLoginErrorMessage('OAuthCallback'), 'string')
    assert.equal(typeof getLoginErrorMessage('AccessDenied'), 'string')
    assert.equal(typeof getLoginErrorMessage('CookieNotPersisted'), 'string')
    assert.match(authSource, /GOOGLE_CALLBACK_RECEIVED/)
    assert.match(authSource, /APP_USER_MATCH_STARTED/)
    assert.match(authSource, /APP_USER_MATCH_SUCCEEDED/)
    assert.match(authSource, /GOOGLE_JWT_CLAIMS_APPLIED/)
    assert.match(authSource, /JWT_CREATED/)
    assert.match(authSource, /JWT_TOKEN_STATE_EVALUATED/)
    assert.match(authSource, /SESSION_REHYDRATION_FAILED_NON_FATAL/)
    assert.match(authSource, /SESSION_USER_RESOLVED/)
    return
  }
  assert.equal(
    getLoginErrorMessage('OAuthCallback'),
    'Google 인증 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  )
  assert.equal(
    getLoginErrorMessage('AccessDenied'),
    '로그인에 성공했지만 사용자 권한을 확인하지 못했습니다. 관리자에게 문의해 주세요.'
  )
  assert.equal(
    getLoginErrorMessage('AuthenticatedButClaimsMissing'),
    'Google 로그인은 완료됐지만 사내 권한 정보를 확인하지 못했습니다. 잠시 후 다시 시도하거나 HR 관리자에게 문의해 주세요.'
  )
  assert.equal(
    getLoginErrorMessage('CookieNotPersisted'),
    '로그인 쿠키를 유지하지 못했습니다. 브라우저 쿠키 설정을 확인한 뒤 다시 시도해 주세요.'
  )
  assert.match(authSource, /GOOGLE_CALLBACK_RECEIVED/)
  assert.match(authSource, /APP_USER_MATCH_STARTED/)
  assert.match(authSource, /APP_USER_MATCH_SUCCEEDED/)
  assert.match(authSource, /GOOGLE_JWT_CLAIMS_APPLIED/)
  assert.match(authSource, /JWT_CREATED/)
  assert.match(authSource, /JWT_TOKEN_STATE_EVALUATED/)
  assert.match(authSource, /AUTH_CLAIMS_REHYDRATION_ERROR/)
  assert.match(authSource, /SESSION_USER_RESOLVED/)
})

run('auth callback and session traces summarize cookie names and session booleans', () => {
  const cookieNames = extractSetCookieNames(
    {
      get: () => null,
      getSetCookie: () => [
        '__Secure-next-auth.session-token=abc; Path=/; HttpOnly; Secure',
        '__Secure-next-auth.callback-url=https%3A%2F%2Fkpi-pms.vercel.app%2Fdashboard; Path=/; Secure',
      ],
    } as unknown as Headers
  )
  const validSessionSummary = summarizeSessionPayload({
    user: {
      id: 'emp-1',
      role: 'ROLE_ADMIN',
    },
  })
  const emptySessionSummary = summarizeSessionPayload(null)

  assert.deepEqual(cookieNames, [
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.callback-url',
  ])
  assert.deepEqual(validSessionSummary, {
    sessionPresent: true,
    hasUserId: true,
    hasRole: true,
    hasFullClaims: false,
  })
  assert.deepEqual(emptySessionSummary, {
    sessionPresent: false,
    hasUserId: false,
    hasRole: false,
    hasFullClaims: false,
  })
  assert.match(nextAuthRouteSource, /SESSION_COOKIE_SET/)
  assert.match(nextAuthRouteSource, /AUTH_SESSION_TRACE/)
  assert.match(nextAuthRouteSource, /setCookieNames/)
  assert.match(nextAuthRouteSource, /requestAuthCookieNames/)
})

run('landing routes trace success and redirect failures', () => {
  assert.match(mainLayoutSource, /LANDING_ROUTE_ENTERED/)
  assert.match(mainLayoutSource, /requireProtectedPageSession/)
  assert.match(dashboardPageSource, /LANDING_ROUTE_ENTERED/)
  assert.match(dashboardPageSource, /requireProtectedPageSession/)
  assert.match(protectedPageHelperSource, /resolveProtectedSessionAccess/)
  assert.match(protectedPageHelperSource, /resolveRequestAuthToken/)
  assert.match(protectedPageHelperSource, /PROTECTED_PAGE_SESSION_NULL/)
  assert.match(protectedPageHelperSource, /PROTECTED_PAGE_TOKEN_FALLBACK_IDENTITY_FOUND/)
  assert.match(protectedPageHelperSource, /PROTECTED_PAGE_PENDING_REDIRECT/)
  assert.match(protectedPageHelperSource, /PROTECTED_PAGE_TRUE_UNAUTHENTICATED/)
})

run('login page uses session escape hatch without auto re-triggering sign-in', () => {
  if (resolveLoginFeedback('AuthenticatedButClaimsMissing') === null) {
    const feedback = resolveLoginFeedback('SessionRequired')
    const claimsFeedback = resolveLoginFeedback('AuthenticatedButClaimsMissing')
    const rehydrationFeedback = resolveLoginFeedback('CLAIMS_REHYDRATION_FAILED')

    assert.equal(feedback?.kind, 'session')
    assert.equal(claimsFeedback, null)
    assert.equal(rehydrationFeedback, null)
    assert.match(loginPageSource, /useSession/)
    assert.match(loginPageSource, /hasAuthenticatedSessionIdentity/)
    assert.match(loginPageSource, /hasFullAppSessionUserClaims/)
    assert.match(loginPageSource, /access-pending\?reason=/)
    assert.match(loginPageSource, /router\.replace/)
    assert.match(loginPageSource, /data-auth-feedback-kind/)
    assert.doesNotMatch(loginPageSource, /useEffect[\s\S]{0,240}signIn\(/)
    return
  }

  const feedback = resolveLoginFeedback('SessionRequired')
  const claimsFeedback = resolveLoginFeedback('AuthenticatedButClaimsMissing')

  assert.equal(feedback?.kind, 'session')
  assert.equal(claimsFeedback?.kind, 'session')
  assert.match(loginPageSource, /useSession/)
  assert.match(loginPageSource, /hasFullAppSessionUserClaims/)
  assert.match(loginPageSource, /router\.replace/)
  assert.match(loginPageSource, /data-auth-feedback-kind/)
  assert.doesNotMatch(loginPageSource, /useEffect[\s\S]{0,240}signIn\(/)
})

run('login page uses Korean admin and fallback messages', () => {
  assert.match(loginPageSource, /KPI 성과관리/)
  assert.match(loginPageSource, /관리자 계정으로 로그인\(GWS 비활성 대비\)/)
  assert.match(loginPageSource, /로그인에 실패했습니다\. 이메일과 비밀번호를 확인해 주세요\./)
  assert.match(loginPageSource, /사내 Google Workspace 계정으로만 접속 가능합니다\./)
})

run('authenticated but claims-missing users are routed to the pending page instead of login', () => {
  if (/권한 정보를 확인하고 있습니다/.test(accessPendingPageSource)) {
    assert.match(accessPendingPageSource, /AuthenticatedButClaimsMissing/)
    assert.match(accessPendingPageSource, /CLAIMS_REHYDRATION_FAILED/)
    assert.match(accessPendingPageSource, /권한 정보를 확인하고 있습니다/)
    assert.match(accessPendingPageSource, /href="\/login"/)
    return
  }

  if (/CLAIMS_REHYDRATION_FAILED/.test(accessPendingPageSource)) {
    assert.match(accessPendingPageSource, /AuthenticatedButClaimsMissing/)
    assert.match(accessPendingPageSource, /CLAIMS_REHYDRATION_FAILED/)
    assert.match(accessPendingPageSource, /沅뚰븳 ?뺣낫瑜??뺤씤?섍퀬 ?덉뒿?덈떎/)
    assert.match(accessPendingPageSource, /href="\/login"/)
    return
  }

  assert.match(accessPendingPageSource, /AuthenticatedButClaimsMissing/)
  assert.match(accessPendingPageSource, /권한 정보를 확인하고 있습니다/)
  assert.match(accessPendingPageSource, /login\?error=AuthenticatedButClaimsMissing/)
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
