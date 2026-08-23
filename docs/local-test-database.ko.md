# 일회성 테스트 데이터베이스

이 PostgreSQL 인스턴스는 로컬 통합 테스트와 E2E 테스트 전용 환경입니다.

Neon과 완전히 분리되어 있으며 `127.0.0.1:5433`에서만 접근할 수 있고, 데이터는 폐기 가능한 Container Storage에 저장됩니다.

## PostgreSQL 시작

Repository Root에서 실행합니다.

```powershell
pnpm db:test:up
pnpm db:test:status
```

## 통합 테스트 실행

다음 명령은 PostgreSQL을 시작하고 Repository에 Commit된 Migration을 적용한 뒤, 로컬 통합 테스트 Suite를 실행합니다.

```powershell
pnpm db:test
```

통합 테스트 초기화 과정에서는 다음 Database만 허용합니다.

```text
localhost:5433/allosta_test
```

기존에 `DATABASE_URL`과 `DIRECT_URL`이 설정되어 있더라도, Neon Credential을 포함한 외부 Database 설정은 Jest Process 내부에서 테스트용 값으로 덮어쓰기 때문에 이 Suite에서는 사용되지 않습니다.

이를 통해 통합 테스트가 실수로 개발 또는 배포 Database를 대상으로 실행되는 것을 방지합니다.

## 기존 Migration 수동 적용

같은 PowerShell Window에서 다음 명령을 실행합니다.

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/allosta_test?schema=public"
$env:DIRECT_URL=$env:DATABASE_URL
$env:JWT_SECRET="local-test-only-secret-change-me"

pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma migrate status
```

`migrate dev`가 아니라 `migrate deploy`를 사용합니다.

이 일회성 Database는 Repository에 이미 Commit된 Migration을 적용하기 위한 환경입니다. 새로운 Migration File을 생성하거나 기존 Migration을 수정하지 않습니다.

## 실제 PostgreSQL을 사용하는 이유

Schema에는 Exclusion Constraint와 Partial Unique Index 등 PostgreSQL 고유의 무결성 규칙이 포함되어 있습니다.

이러한 Constraint는 예약 동시성과 일정 정합성을 보장하는 핵심 요소이므로, 통합 테스트에서는 In-memory Database 대신 실제 PostgreSQL을 사용합니다.

## PostgreSQL 종료 및 데이터 삭제

```powershell
pnpm db:test:down
```

해당 명령은 테스트 Container와 폐기 가능한 Database Storage를 함께 제거합니다.
