# Allosta API

인증, 검사 결과 접근, 상담 일정 관리, 대리 상담 동의, 상담사 업무, 운영자 Reporting 및 미참석 처리를 담당하는 NestJS API입니다.

## 환경 설정

`.env.example`을 `.env`로 복사한 뒤 다음 값을 설정합니다.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
DIRECT_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

- `DATABASE_URL`은 Runtime에서 `@prisma/adapter-pg`를 통해 사용합니다. 배포 환경에서는 Neon의 Pooled Connection을 사용합니다.
- `DIRECT_URL`은 Prisma Migration에서 사용하며 Neon의 Direct Connection을 지정합니다.
- `JWT_SECRET`은 Local Development 외의 환경에서 외부에 노출되지 않는 예측하기 어려운 값이어야 합니다.
- `PORT`의 기본값은 `3000`입니다.

## Database Lifecycle

별도 설명이 없는 한 Repository Root에서 실행합니다.

Prisma Client 생성:

```powershell
pnpm --dir apps/api exec prisma generate
```

Migration 상태 확인:

```powershell
pnpm --dir apps/api exec prisma migrate status
```

Repository에 Commit된 Migration 적용:

```powershell
pnpm --dir apps/api exec prisma migrate deploy
```

Demo Data Seed:

```powershell
pnpm --dir apps/api seed
```

일반적인 환경 구성과 배포에는 `migrate deploy`를 사용합니다.

기존 환경을 초기화하기 위한 목적으로 새로운 Migration을 생성하지 않습니다.

## 개발 서버 실행

Watch Mode로 API를 실행합니다.

```powershell
pnpm --dir apps/api start:dev
```

기본 주소:

```text
http://localhost:3000
```

인증에는 유효기간 8시간의 JWT Access Token을 사용합니다.

MVP에서는 다음 기능을 제공하지 않습니다.

- Refresh Token
- 공개 회원가입
- OAuth Login

## Module 구성

### `auth`

Login, Password 검증, JWT 발급, 인증 Guard 및 Role 검증을 담당합니다.

### `master-data`

상담 업무에 필요한 검사 결과 및 Product Data를 제공합니다.

### `consultations`

다음 기능을 담당합니다.

- 동적 예약 Slot 계산
- 상담 예약
- 상담사 자동 배정
- 기존 예약 변경
- 상담 취소
- 상담사별 상담 목록
- 상담 기록
- DRAFT / FINAL Lifecycle
- 상담 완료

### `availability`

상담사 가용 시간 범위와 일정 관련 제약을 관리합니다.

### `delegations`

특정 검사 결과 단위의 대리 상담 동의를 관리합니다.

- 대리 상담 요청
- 검사 대상자의 직접 승인·거절
- 외부 동의 확인

### `dashboard`

다음 운영 지표를 계산합니다.

- 상태별 상담 건수
- 완료율
- 미참석률
- 상담사별 통계
- 관심 제품 집계

### `operator`

운영자가 전체 상담과 운영 상태를 조회할 수 있는 API를 제공합니다.

### `batch`

상담 종료 시각이 지났지만 여전히 `RESERVED` 상태인 상담을 `NOT_ATTENDED`로 변경합니다.

Scheduled Job은 `Asia/Seoul` 기준 매일 `00:10`에 실행됩니다.

`NOT_ATTENDED`는 예정된 상담 종료 시각이 지났지만 상담 기록이 시작되지 않아 시스템에서 상담 수행을 확인할 수 없는 상태입니다.

`NO_SHOW`와는 의도적으로 구분합니다.

`NO_SHOW`는 고객의 실제 불참이 명시적으로 확인된 경우를 의미하며 현재 MVP에는 이를 생성하는 경로가 없습니다.

## Application 구조

API는 Modular Monolith 구조로 구현되어 있습니다.

업무 규칙이 집중된 다음 Use Case에는 CQRS Handler를 선택적으로 적용합니다.

- 상담 예약 및 Lifecycle
- 상담사 Availability
- 대리 상담 동의
- Dashboard 조회

비교적 단순한 기능에는 일반적인 NestJS Service / Controller 구조를 사용합니다.

Read와 Write는 동일한 PostgreSQL Database를 사용합니다.

## 예약 및 동시성

고객은 검사 결과와 상담 시간을 선택하며 상담사를 직접 선택하지 않습니다.

Server는 다음 조건을 기준으로 적합한 상담사를 자동 배정합니다.

- 상담사 활성 상태
- 지원 가능한 검사 유형
- 등록된 상담 가능 시간
- 기존 활성 상담
- 해당 일자의 현재 상담 배정량

활성 상담 상태는 다음과 같습니다.

```text
RESERVED
DOCUMENTING
```

동시 예약 충돌에 대한 최종 방어는 Database Constraint가 담당합니다.

Schema에는 PostgreSQL 고유의 Exclusion Constraint와 Partial Unique Constraint가 포함되어 있습니다.

예약 및 예약 변경 Flow에서는 데이터 정합성을 위해 Database Transaction도 사용합니다.

## 상담 기록

상담 기록은 두 상태로 관리합니다.

```text
DRAFT
FINAL
```

최초 DRAFT 저장 시 상담 상태는 다음과 같이 변경됩니다.

```text
RESERVED → DOCUMENTING
```

최종 확정에서는 두 Resource의 상태를 하나의 Transaction으로 변경합니다.

```text
ConsultationRecord
DRAFT → FINAL

Consultation
DOCUMENTING → COMPLETED
```

FINAL 기록은 MVP에서 수정할 수 없습니다.

## 테스트 및 Build

API Unit Test:

```powershell
pnpm --dir apps/api test --runInBand
```

PostgreSQL Integration Test:

```powershell
pnpm db:test
```

API Build:

```powershell
pnpm --dir apps/api build
```

`pnpm db:test`는 `127.0.0.1:5433`에서 일회성 PostgreSQL을 실행하고, Commit된 Migration을 적용한 뒤 Integration Test Suite를 실행합니다.

테스트 초기화 과정에서는 전용 Local Test Database 이외의 접속 대상을 허용하지 않습니다.

Exclusion Constraint, Partial Unique Index, Transaction 및 예약 충돌은 실제 검증 대상이므로 In-memory Database 대신 실제 PostgreSQL을 사용합니다.
