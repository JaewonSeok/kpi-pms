# KPI 성과관리 시스템 - 설치 및 실행 가이드

## 사전 요구사항

- Node.js 18+
- PostgreSQL 15+
- Google Workspace 계정 (SSO 사용 시)

---

## 1단계: 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 다음 항목을 설정하세요:

```env
# PostgreSQL 연결 문자열
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/kpi_pms"

# NextAuth 설정 (임의의 랜덤 문자열)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-key"
# AUTH_URL="http://localhost:3000"
# AUTH_SECRET="your-random-secret-key"

# Google OAuth (선택 - GWS SSO 사용 시)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
ALLOWED_DOMAIN="your-company.com"

# 관리자 임시 계정 (GWS 장애 대비)
ADMIN_EMAIL="admin@your-company.com"
ADMIN_PASSWORD="your-secure-password"
```

---

## 2단계: 데이터베이스 생성

PostgreSQL에서:
```sql
CREATE DATABASE kpi_pms;
```

---

## 3단계: 패키지 설치 및 DB 마이그레이션

```bash
npm install

# DB 스키마 적용
npx prisma migrate dev --name init

# 또는 (마이그레이션 없이 빠른 적용)
npx prisma db push

# 샘플 데이터 입력
npm run db:seed
```

---

## 4단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 5단계: 첫 로그인

시드 데이터가 생성되면 다음 계정으로 로그인 가능합니다:

| 역할 | 이메일 |
|------|--------|
| 대표이사 | ceo@company.com |
| 본부장 | divhead@company.com |
| 실장 | section@company.com |
| 팀장 | leader@company.com |
| 팀원 | member1@company.com |
| HR 관리자 | admin@company.com |

> **주의**: 위 이메일들이 Google Workspace에 없는 경우, ADMIN_EMAIL에 설정한 관리자 계정으로 로그인하세요.

---

## Google OAuth 설정 (선택)

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 → APIs & Services → OAuth consent screen 설정
3. Credentials → OAuth 2.0 Client ID 생성
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Client ID와 Secret을 `.env`에 입력

---

## 프로덕션 배포 (Docker)

```bash
# Docker Compose로 전체 스택 실행
docker compose up -d
```

`docker-compose.yml` 파일을 별도로 작성하거나 `.env` 값을 환경에 맞게 수정하세요.

---

## 주요 명령어

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run db:studio    # Prisma Studio (DB GUI)
npm run db:seed      # 샘플 데이터 입력
npm run db:reset     # DB 초기화 (주의!)
```
