# Allosta Consultation Operations Platform

검사 결과를 기반으로 고객이 상담을 예약하고, 상담사가 상담 내용을 기록하며, 운영자가 상담 현황과 성과를 확인할 수 있는 **건강상담 운영 플랫폼 MVP**입니다.

알로스타의 검사 결과 상담이 수동으로 운영된다는 문제 상황을 바탕으로 요구사항을 정의하고, **예약 → 상담 → 기록 → 운영 데이터**가 하나의 일관된 프로세스로 연결되도록 설계하고 구현했습니다.

---

## Demo

- **Web:** https://jyonyve.github.io/allosta/
- **API:** https://alostar-api.onrender.com/
- **Repository:** https://github.com/Jyonyve/allosta

> Render Free 인스턴스는 일정 시간 요청이 없으면 sleep 상태가 될 수 있어 첫 요청에 시간이 걸릴 수 있습니다.

모든 데모 계정의 비밀번호는 다음과 같습니다.

```text
DemoPass123!
```

| 역할      | 이메일                 | 이름   | 데모 시나리오                           |
| --------- | ---------------------- | ------ | --------------------------------------- |
| 고객      | `customer@demo.local`  | 박서연 | 본인 검사 결과 조회 및 상담 예약        |
| 대리 고객 | `proxy@demo.local`     | 박준호 | 승인된 가족 검사 결과 접근 및 상담 예약 |
| 고객      | `delegator@demo.local` | 박민지 | 신규 대리 상담 요청 시연                |
| 상담사    | `advisor1@demo.local`  | 김지훈 | 대사·음식 반응 검사 상담                |
| 상담사    | `advisor2@demo.local`  | 이수진 | 대사·영양·건강 위험도 검사 상담         |
| 운영자    | `operator@demo.local`  | 최민석 | 상담 현황 및 운영 지표 확인             |

`박정숙`은 플랫폼 계정이 없는 검사 대상자입니다.  
이를 통해 외부 절차에서 확인된 동의 사실을 운영자가 등록하는 대리 상담 흐름을 확인할 수 있습니다.

---

## Demo Scenario

### 1. 고객 상담 예약

`customer@demo.local`로 로그인합니다.

1. 상담할 검사 결과를 선택합니다.
2. 실제 예약 가능한 시간을 조회합니다.
3. 원하는 시간을 선택해 상담을 예약합니다.
4. 같은 검사 결과에서 다른 시간을 선택하면 기존 예약 변경 흐름을 확인할 수 있습니다.

고객은 상담사를 직접 선택하지 않습니다.

서버가 검사 유형, 상담사의 상담 가능 시간, 기존 예약 상태를 기준으로 적합한 상담사를 자동 배정합니다.

### 2. 대리 상담

`proxy@demo.local`로 로그인하면 승인된 대리 상담 권한이 있는 검사 결과에 접근할 수 있습니다.

대리 상담 권한은 검사 대상자 전체가 아니라 **특정 검사 결과(TestResult) 하나에만 적용**됩니다.

### 3. 상담 기록

상담사 계정으로 로그인합니다.

1. 자신에게 배정된 상담을 조회합니다.
2. 상담 기록을 DRAFT로 저장합니다.
3. 주요 문의, 상담 요약, 내부 메모, 관심 제품, 후속 조치를 기록합니다.
4. 기록을 최종 확정하면 상담도 함께 완료됩니다.

최초 DRAFT 저장 시 상담은 `DOCUMENTING` 상태가 되고, 최종 확정 시 상담 기록의 `FINAL`과 상담의 `COMPLETED`가 하나의 Transaction으로 처리됩니다.

### 4. 운영 현황

`operator@demo.local`로 로그인하면 다음을 확인할 수 있습니다.

- 상태별 상담 건수
- 상담사별 상담 현황
- 상담 완료율
- 미참석률
- 관심 제품 집계
- 상담 상세 및 상담 기록
- 외부 동의 확인
- 미참석 처리 수동 실행

---

## 주요 기능

### 고객

- 이메일/비밀번호 로그인
- 접근 가능한 검사 결과 조회
- 예약 가능 시간 조회
- 상담 예약
- 상담사 자동 배정
- 기존 예약 시간 변경
- 상담 취소
- 상담 목록 및 상태 확인
- 검사 결과 단위 대리 상담 요청
- 대리 상담 승인·거절

### 상담사

- 상담 가능 시간 등록·수정·삭제
- 배정된 상담 조회
- 검사 대상자 및 검사 정보 확인
- 상담 기록 DRAFT 저장·수정
- 관심 제품 및 후속 조치 기록
- 상담 기록 최종 확정
- 상담 완료

### 운영자

- 전체 상담 현황 조회
- 상담 상세 및 기록 조회
- 상담사별 현황 확인
- 완료율 및 미참석률 조회
- 관심 제품 집계
- 외부에서 확인된 대리 상담 동의 사실 등록
- 미참석 처리 작업 수동 실행

---

## 핵심 설계

### User와 Examinee 분리

로그인하여 시스템에서 행동하는 `User`와 실제 검사 결과가 귀속되는 `Examinee`를 별도 모델로 구성했습니다.

```text
User
- 로그인
- 예약
- 동의
- 상담 및 운영 행위

Examinee
- 실제 검사 대상자
- 검사 결과의 귀속 주체
```

이를 통해 플랫폼 계정이 없는 가족의 검사 결과도 표현할 수 있습니다.

### 검사 결과 단위 대리 상담 권한

가족 관계만으로 모든 검사 결과 접근을 허용하지 않습니다.

`ConsultationDelegation`은 항상 특정 `TestResult`에 연결되며, 조회와 예약 시 Backend에서 권한을 다시 검증합니다.

동의 방식은 다음 두 가지를 구분합니다.

- `SELF_SERVICE`: 검사 대상자가 플랫폼에서 직접 승인
- `EXTERNAL_VERIFIED`: 외부 절차에서 확인된 동의 사실을 운영자가 등록

### 동적 예약 가능 시간

예약 Slot을 Database에 미리 생성하지 않습니다.

```text
Advisor Availability
+ Scheduling Policy
- Existing Active Consultations
= Available Slots
```

상담사의 가용 시간 범위와 전사 예약 정책을 기준으로 실제 예약 가능한 시간을 동적으로 계산합니다.

Seed 기준 운영 정책:

- 상담 시간: 30분
- Slot 간격: 30분
- 최소 예약 선행 시간: 60분
- 취소 마감: 상담 60분 전
- 예약 가능 기간: 30일

### 상담사 자동 배정

고객은 상담 시간을 선택하고, 상담사는 서버가 결정합니다.

자동 배정 후보는 다음 조건을 모두 만족해야 합니다.

1. 활성 상담사
2. 해당 검사 유형 상담 가능
3. 요청 시간이 상담 가능 시간 범위에 포함
4. 동일 시간에 겹치는 활성 상담이 없음

후보가 여러 명이면 해당 날짜의 활성 예약 수가 적은 상담사를 우선 배정합니다.

### 예약 중복 및 동시성

Application에서 예약 가능 여부를 먼저 확인하고, PostgreSQL Constraint를 최종 동시성 방어 수단으로 사용합니다.

활성 상담은 다음 상태입니다.

```text
RESERVED
DOCUMENTING
```

활성 상담에 대해 다음 중복을 허용하지 않습니다.

- 동일 상담사의 동일 시간 예약
- 동일 고객의 동일 시간 예약
- 동일 검사 결과의 복수 활성 상담

예약 생성은 Serializable Transaction에서 처리합니다.

### 예약 변경

동일 검사 결과에 이미 활성 상담이 있으면 일반 예약 요청은 충돌로 반환합니다.

고객이 변경을 확인한 경우 기존 예약을 정리하고 새로운 상담을 생성합니다.

```text
미래 RESERVED
→ CANCELLED

예정 시간이 지난 RESERVED
→ NOT_ATTENDED

DOCUMENTING
→ 변경 불가
```

기존 상담 종결과 신규 상담 생성은 하나의 Transaction으로 처리합니다.

### 상담 기록

상담 기록은 다음 두 상태로 관리합니다.

```text
DRAFT → FINAL
```

최초 DRAFT 저장 시 상담은 다음과 같이 변경됩니다.

```text
RESERVED → DOCUMENTING
```

최종 확정은 다음 두 변경을 하나의 Transaction으로 수행합니다.

```text
ConsultationRecord
DRAFT → FINAL

Consultation
DOCUMENTING → COMPLETED
```

FINAL 기록은 MVP에서 직접 수정하지 않습니다.

### NOT_ATTENDED와 NO_SHOW

전화 시스템과 직접 연동하지 않으므로 시스템만으로 고객의 실제 불참을 확정할 수 없습니다.

따라서 다음 두 상태를 구분합니다.

| 상태           | 의미                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| `NOT_ATTENDED` | 상담 종료 시각이 지났지만 기록이 없어 시스템에서 상담 수행을 확인할 수 없는 상태 |
| `NO_SHOW`      | 고객의 실제 불참이 상담사 또는 외부 시스템을 통해 명시적으로 확인된 상태         |

MVP에서는 종료 시간이 지난 `RESERVED` 상담을 `NOT_ATTENDED`로 자동 처리합니다.

`NO_SHOW`는 향후 CTI 등 실제 통화 결과를 확인할 수 있는 시스템 연계를 고려해 상태만 정의했습니다.

### 운영 지표

완료율과 미참석률은 결과가 확정된 상담을 기준으로 계산합니다.

```text
종결 상담
= COMPLETED + NOT_ATTENDED + NO_SHOW

완료율
= COMPLETED / 종결 상담

미참석률
= (NOT_ATTENDED + NO_SHOW) / 종결 상담
```

`CANCELLED`, `RESERVED`, `DOCUMENTING`은 분모에서 제외합니다.

종결 상담이 없는 경우 비율은 `0`이 아닌 `null`을 반환합니다.

---

## Frontend State Management

Frontend에서는 **화면 상태와 서버 상태의 책임을 분리**합니다.

### React Local State

다음과 같은 UI 상태는 React의 local state로 관리합니다.

- 선택된 화면 및 탭
- 선택된 검사 결과
- 예약 날짜 및 시간
- Modal 상태
- 상담 기록 Form 입력값
- 사용자 알림 메시지
- 로그인 Session
- 언어 설정

### TanStack Query

API에서 조회하거나 변경되는 서버 상태는 TanStack Query로 관리합니다.

주요 Query 대상:

- 검사 결과
- 상담 목록
- 예약 가능 시간
- 상담사 프로필
- 상담사 가용 시간
- 제품 목록
- 상담 기록
- 운영 Dashboard
- 대리 상담 요청

Mutation 이후에는 관련 Query를 invalidate하여 서버의 최신 상태를 다시 반영합니다.

예:

```text
상담 예약
→ consultations invalidate
→ available-slots invalidate

상담 기록 FINAL 확정
→ advisor consultations invalidate
→ operator dashboard invalidate
→ operator consultations invalidate

상담사 가용 시간 변경
→ advisor availability invalidate
```

API 호출 자체는 `api.ts`의 공통 Fetch Wrapper를 유지합니다.

TanStack Query는 HTTP Client를 대체하는 것이 아니라 **서버 상태의 조회, 캐싱, 동기화와 Mutation 생명주기**를 담당합니다.

---

## Architecture

```text
Browser
   │
   ▼
React / Vite
TanStack Query
   │
   ▼
NestJS API
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

배포 구성:

```text
GitHub Pages
    │
    │ HTTPS
    ▼
Render
    │
    ▼
Neon PostgreSQL
```

Backend는 **Modular Monolith** 구조로 구성했습니다.

상담 예약, 상담 가능 시간, 대리 상담, 운영 지표와 같이 업무 규칙이 집중되는 영역에는 Logical CQRS를 적용하며 Read/Write Database를 물리적으로 분리하지는 않습니다.

---

## Technology

| 영역                | 기술                                         |
| ------------------- | -------------------------------------------- |
| Frontend            | React 19, TypeScript, Vite 8                 |
| Server State        | TanStack Query                               |
| HTTP Client         | Fetch API + typed API wrapper                |
| Backend             | NestJS 11, TypeScript                        |
| Application Pattern | Modular Monolith, Logical CQRS               |
| ORM                 | Prisma 7                                     |
| Database            | PostgreSQL 17 / Neon                         |
| Authentication      | Email/Password, bcrypt, JWT                  |
| Scheduler           | `@nestjs/schedule`                           |
| Test                | Jest, Supertest, PostgreSQL Integration Test |
| CI/CD               | GitHub Actions                               |
| Web Hosting         | GitHub Pages                                 |
| API Hosting         | Render                                       |
| Database Hosting    | Neon                                         |

React Router는 현재 역할별 단일 Workspace와 내부 View 전환 구조에서 별도의 URL Routing이 필요하지 않아 도입하지 않았습니다.

---

## Repository Structure

```text
allosta/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  ├─ migrations/
│  │  │  ├─ schema.prisma
│  │  │  └─ seed.ts
│  │  ├─ src/
│  │  │  ├─ auth/
│  │  │  ├─ availability/
│  │  │  ├─ batch/
│  │  │  ├─ common/
│  │  │  ├─ consultations/
│  │  │  ├─ dashboard/
│  │  │  ├─ delegations/
│  │  │  ├─ master-data/
│  │  │  ├─ operator/
│  │  │  └─ prisma/
│  │  └─ test/
│  └─ web/
│     └─ src/
│        ├─ App.tsx
│        ├─ AdvisorPortal.tsx
│        ├─ OperatorPortal.tsx
│        ├─ api.ts
│        ├─ queries.ts
│        ├─ i18n.tsx
│        └─ main.tsx
├─ docs/
│  ├─ deployment.md
│  └─ local-test-database.md
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ pages.yml
├─ compose.test.yml
├─ render.yaml
├─ pnpm-workspace.yaml
└─ README.md
```

---

## Local Development

### Requirements

- Node.js 24
- pnpm 11.18.0
- PostgreSQL
- Docker Desktop — Integration Test 실행 시 필요

### Install

```powershell
git clone https://github.com/Jyonyve/allosta.git
cd allosta

pnpm install --frozen-lockfile

Copy-Item apps/api/.env.example apps/api/.env
```

`apps/api/.env`에 다음 값을 설정합니다.

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
```

- `DATABASE_URL`: Application Runtime에서 사용할 PostgreSQL 연결
- `DIRECT_URL`: Prisma Migration에서 사용할 Direct 연결
- `JWT_SECRET`: JWT 서명용 Secret

### Database

Prisma Client 생성:

```powershell
pnpm --dir apps/api exec prisma generate
```

Migration 적용:

```powershell
pnpm --dir apps/api exec prisma migrate deploy
```

Demo Seed:

```powershell
pnpm --dir apps/api seed
```

### Run API

```powershell
pnpm --dir apps/api start:dev
```

```text
http://localhost:3000
```

### Run Web

별도 Terminal에서 실행합니다.

```powershell
pnpm --dir apps/web dev
```

```text
http://localhost:5173
```

기본 로컬 환경에서는 Vite가 `/api` 요청을 `http://localhost:3000`으로 Proxy합니다.

---

## Test

### API Unit Test

```powershell
pnpm --dir apps/api test --runInBand
```

### PostgreSQL Integration Test

통합 테스트는 개발 및 운영 Database와 분리된 일회성 PostgreSQL 17 환경에서 실행합니다.

```powershell
pnpm db:test
```

테스트 환경은 다음 Database만 사용할 수 있도록 보호되어 있습니다.

```text
localhost:5433/allosta_test
```

따라서 실수로 Neon 등 외부 Database URL이 환경 변수에 남아 있더라도 통합 테스트 대상으로 사용할 수 없습니다.

테스트 Database 종료 및 삭제:

```powershell
pnpm db:test:down
```

### Build & Lint

```powershell
pnpm --dir apps/api build
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

---

## CI

GitHub Actions는 `main` Push 및 Pull Request에서 다음 검증을 수행합니다.

```text
Install Dependencies
→ Generate Prisma Client
→ Apply Database Migrations
→ API Unit Tests
→ PostgreSQL Integration Tests
→ API Build
→ Web Lint
→ Web Build
```

PostgreSQL 17 Service Container를 사용하므로 외부 Database에 의존하지 않습니다.

Web 관련 변경이 `main`에 반영되면 별도의 Workflow가 Vite Application을 빌드하여 GitHub Pages에 배포합니다.

---

## Deployment

현재 Demo는 다음 구조로 배포합니다.

```text
GitHub Pages
    │
    ▼
Render Web Service
    │
    ▼
Neon PostgreSQL
```

Render 환경 변수:

```text
DATABASE_URL
DIRECT_URL
JWT_SECRET
SEED_DEMO
```

Frontend 배포 시 GitHub Actions Repository Variable `API_URL`을 `VITE_API_URL`로 전달하여 API Endpoint를 Build에 포함합니다.

상세한 배포 절차는 [`docs/deployment.md`](docs/deployment.md)를 참고합니다.

---

## MVP Scope

이번 구현의 범위는 **검사 결과가 이미 생성된 이후의 상담 운영 과정**입니다.

MVP 이후 확장 가능한 영역은 다음과 같습니다.

- AI 기반 상담 보조
- 검사 분석 및 결과 생성 시스템 연계
- SMS / 카카오 예약 알림
- 실제 주문·결제 연동
- 구매 전환 Funnel 분석
- 상담사 반복 근무 일정
- 휴가·휴무 관리
- 대기 예약
- CTI 통화 결과 연계
- OAuth / Refresh Token 기반 인증
- 전자서명 및 본인인증
- FINAL 상담 기록 정정 이력

이번 MVP에서는 기능의 수를 늘리기보다 **예약 정합성, 민감정보 접근 권한, 상태 전이, 상담 기록, 운영 데이터의 연결**을 우선했습니다.

---

## Documentation

상세한 문제 정의, 요구사항, MVP 범위와 시스템 설계는 별도 제출 문서에서 확인할 수 있습니다.

Repository 내 개발·운영 문서는 에이전틱 코딩과 개발 자동화에서도 활용할 수 있도록 영어 원문을 유지하며,
동료 개발자가 별도의 번역 없이 환경과 운영 절차를 확인할 수 있도록 한국어 문서도 함께 제공합니다.

- [`docs/local-test-database.ko.md`](docs/local-test-database.ko.md) — 로컬 PostgreSQL Integration Test 환경 및 안전 장치
  - [English](docs/local-test-database.md)
- [`docs/deployment.ko.md`](docs/deployment.ko.md) — GitHub Pages + Render + Neon 배포 절차
  - [English](docs/deployment.md)
- [`apps/api/README.ko.md`](apps/api/README.ko.md) — API 개발 및 환경 설정
  - [English](apps/api/README.md)
- [`apps/web/README.ko.md`](apps/web/README.ko.md) — Frontend 개발 환경
  - [English](apps/web/README.md)
