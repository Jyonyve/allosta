# Allosta Web Portal

Allosta 상담 운영 플랫폼의 React + Vite 기반 Frontend Application입니다.

인증된 사용자의 Role에 따라 고객, 상담사 또는 운영자 Workspace를 표시합니다.

한국어와 영어 Interface를 지원하며 최초 방문 시 한국어를 기본값으로 사용합니다. 사용자가 선택한 언어는 Local Storage에 저장합니다.

## 기술 구성

- React 19
- TypeScript
- Vite 8
- TanStack Query
- Fetch API + Type-safe API Wrapper

React Router는 의도적으로 사용하지 않았습니다.

현재 MVP는 Role별 단일 Workspace와 내부 View 전환 구조이므로 URL 기반 Routing을 추가해도 실질적인 Navigation 이점이 크지 않고 복잡도만 증가한다고 판단했습니다.

## 상태 관리

Frontend에서는 Local UI State와 Remote Server State의 책임을 분리합니다.

### React Local State

다음과 같이 사용자 Interaction에 종속적인 상태는 React Local State로 관리합니다.

- 선택한 Workspace View 또는 Tab
- 선택한 검사 결과
- 선택한 예약 날짜와 시간
- Modal 표시 상태
- Form 입력값
- 상담 기록 Editor 입력값
- Local 안내 메시지
- 인증 Session
- 언어 설정

### TanStack Query

API에서 조회하는 Remote Server State는 TanStack Query로 관리합니다.

주요 대상은 다음과 같습니다.

- 접근 가능한 검사 결과
- 고객 상담 목록
- 예약 가능 Slot
- 대리 상담 요청
- 상담사 Profile
- 상담사 Availability
- 상담사 상담 목록
- Product
- 운영 Dashboard
- 운영자 상담 Data
- 외부 동의 확인 Queue

Mutation 성공 후에는 필요한 Query만 선택적으로 invalidate하여 수동 Reload Logic을 중복해서 관리하지 않고 Server의 최신 상태와 UI를 동기화합니다.

예:

```text
상담 예약 또는 예약 변경
→ 고객 상담 목록 invalidate
→ 해당 검사 결과의 예약 가능 Slot invalidate
```

```text
상담사 가용 시간 변경
→ 상담사 Availability invalidate
```

```text
상담 기록 FINAL 확정
→ 상담사 상담 목록 invalidate
→ 관련 운영 Data 갱신
```

```text
미참석 처리 실행
→ 운영 Dashboard invalidate
→ 운영자 상담 목록 invalidate
```

기존 `api.ts`는 HTTP 통신 계층으로 그대로 사용합니다.

TanStack Query는 `fetch`를 대체하는 HTTP Client가 아니라 Server State의 Cache, Loading/Error 상태, Mutation, Invalidation 및 동기화를 담당합니다.

## API Layer

API 호출은 다음 File에 집중되어 있습니다.

```text
apps/web/src/api.ts
```

공통 API Wrapper는 다음 기능을 제공합니다.

- Type이 정의된 Request / Response Model
- `Authorization: Bearer` Header 처리
- JSON Serialization
- Request Timeout 처리
- 공통 `ApiError`
- `VITE_API_URL` 지원

JWT Token 자체는 TanStack Query Key에 포함하지 않습니다.

Session이 종료되면 인증된 Query Cache도 함께 제거하여 한 Demo 사용자의 Data가 Logout 이후 다른 Role 계정에서 재사용되지 않도록 합니다.

## 개발 서버 실행

Repository Root에서 실행합니다.

```powershell
pnpm --dir apps/web dev
```

기본 Vite Development Server:

```text
http://localhost:5173
```

기본 Local Development 환경에서 `/api` 요청은 다음 API로 Proxy됩니다.

```text
http://localhost:3000
```

## API 설정

기본 Local 환경에서는 Frontend용 환경변수 File이 필요하지 않습니다.

배포된 API를 사용하는 경우 `.env.example`을 `.env.production.local`로 복사한 뒤 다음 값을 지정합니다.

```dotenv
VITE_API_URL=https://api.example.com
```

`VITE_*` 환경변수에는 Browser에 공개되어도 안전한 설정만 저장해야 합니다.

다음 값은 Vite 환경변수에 절대 넣어서는 안 됩니다.

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- 기타 Server Credential

Vite 환경변수는 Client Bundle에 포함되므로 사용자에게 노출됩니다.

## Role별 Workspace

### 고객

고객 Workspace에서는 다음 기능을 제공합니다.

- 접근 가능한 검사 결과 조회
- 동적 예약 가능 시간 조회
- 상담 예약
- 기존 예약 시간 변경
- 정책상 허용되는 예약 취소
- 상담 이력
- 대리 상담 요청
- 대리 상담 승인·거절

### 상담사

상담사 Workspace에서는 다음 기능을 제공합니다.

- 배정된 상담 일정
- 상담 가능 시간 관리
- 상담 기록 DRAFT 작성
- 관심 제품 선택
- 후속 조치 기록
- FINAL 기록 확정

### 운영자

운영자 Workspace에서는 다음 기능을 제공합니다.

- 운영 Dashboard
- 상담 상태별 집계
- 상담사별 성과
- 상담 상세 조회
- 관심 제품 집계
- 외부 동의 확인
- 미참석 처리 수동 실행

## Session 동작

JWT Session은 `sessionStorage`에 저장합니다.

Logout 시 다음 작업을 수행합니다.

- 저장된 Session 제거
- 인증된 TanStack Query Cache 제거
- Login 화면으로 복귀

API가 `401`을 반환하는 경우에도 Session을 제거하고 Login 화면으로 돌아갑니다.

Demo에서는 같은 Browser에서 CUSTOMER, ADVISOR, OPERATOR Seed 계정을 연속으로 사용할 수 있으므로 이전 사용자의 Cache가 다음 계정에 노출되지 않도록 하는 것이 중요합니다.

## 검증

Lint:

```powershell
pnpm --dir apps/web lint
```

Production Build:

```powershell
pnpm --dir apps/web build
```

Production Build에서는 TypeScript Project Reference 검증 후 Vite Bundling을 수행합니다.
