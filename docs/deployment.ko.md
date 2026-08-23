# 배포: GitHub Pages + Render API + Neon PostgreSQL

Demo는 다음 세 Provider로 나누어 배포합니다.

- GitHub Pages에서 React/Vite 정적 Frontend를 제공합니다.
- Render에서 NestJS API를 실행합니다.
- Neon에서 PostgreSQL을 운영합니다.

```text
Browser
   │
   ▼
GitHub Pages
React / Vite
   │
   │ HTTPS API 요청
   ▼
Render Web Service
NestJS API
   │
   ▼
Neon PostgreSQL
```

## 1. Database 준비 — Neon

Neon에서 PostgreSQL Database를 생성하고 두 개의 Connection String을 준비합니다.

- `DATABASE_URL` — Application Runtime에서 사용하는 Pooled Connection String
- `DIRECT_URL` — Prisma Migration에서 사용하는 Direct Connection String

두 값은 Server 환경에만 보관해야 하며 Vite 환경변수로 노출해서는 안 됩니다.

## 2. API 배포 — Render

### Blueprint 방식 — 권장

Repository를 Push한 뒤 Render에서 다음을 선택합니다.

**New → Blueprint**

해당 Repository를 선택합니다.

Render는 `render.yaml`을 읽어 `allosta-api` Web Service를 만들고, `sync: false`로 지정된 환경변수 입력을 요청합니다.

| 변수           | 값                                        |
| -------------- | ----------------------------------------- |
| `DATABASE_URL` | Neon Pooled Connection String             |
| `DIRECT_URL`   | Neon Direct Connection String             |
| `JWT_SECRET`   | 충분히 길고 예측하기 어려운 Random Secret |

예:

```bash
openssl rand -hex 32
```

`render.yaml`에서 `SEED_DEMO`의 기본값은 `"true"`입니다.

활성화되어 있으면 Migration 적용 이후 Application 시작 과정에서 Demo Data를 Seed합니다.

더 이상 Demo Data를 다시 Seed할 필요가 없다면 `"false"`로 변경할 수 있습니다.

### Render 수동 설정

다음 방식으로도 배포할 수 있습니다.

1. **New → Web Service**를 선택합니다.
2. Repository를 연결합니다.
3. Root Directory를 `.`으로 지정합니다.
4. `render.yaml`에 정의된 Build / Start Command를 사용합니다.
5. 위와 동일한 환경변수를 등록합니다.

배포 과정에서 Prisma Client 생성과 API Build를 수행합니다.

Application 시작 시에는 다음 순서로 실행됩니다.

```text
prisma migrate deploy
→ 필요 시 Demo Seed
→ NestJS Production Server
```

`GET /` Endpoint를 Health Check로 사용합니다.

## 3. Frontend 배포 — GitHub Pages

Repository에서 다음 순서로 설정합니다.

1. **Settings → Pages**를 엽니다.
2. Source를 **Deploy from a GitHub Action**으로 설정합니다.
3. **Settings → Secrets and variables → Actions → Variables**를 엽니다.
4. 다음 Repository Variable을 추가합니다.

| 이름      | 값                                 |
| --------- | ---------------------------------- |
| `API_URL` | `https://alostar-api.onrender.com` |

URL 마지막에 `/`를 붙이지 않습니다.

Pages Workflow는 이 값을 Vite Build에 `VITE_API_URL`로 전달합니다.

Frontend 관련 변경을 `main` Branch에 Push하거나 **Deploy web to GitHub Pages** Workflow를 수동 실행합니다.

Workflow는 다음 Application을 Build합니다.

```text
apps/web
```

그리고 다음 Directory를 배포합니다.

```text
apps/web/dist
```

`API_URL`이 없으면 Workflow가 즉시 실패하도록 구성되어 있습니다.

이를 통해 Production Build가 실수로 Local `/api` Proxy를 사용하는 상황을 방지합니다.

## 무료 Tier 사용 시 주의사항

### Render Sleep

Render Free Web Service는 일정 시간 요청이 없으면 Sleep 상태가 될 수 있습니다.

따라서 Sleep 이후 첫 API 요청은 Service가 다시 시작되는 동안 응답이 느릴 수 있습니다.

### 미참석 자동 처리

API에는 `Asia/Seoul` 기준 매일 `00:10`에 실행되는 Scheduled Job이 있습니다.

상담 종료 시각이 지났지만 여전히 `RESERVED` 상태인 상담을 `NOT_ATTENDED`로 변경합니다.

Scheduler가 Render Application Process 내부에서 실행되므로, Free Render Instance가 Sleep 상태인 동안에는 Scheduled 실행을 보장할 수 없습니다.

Demo 환경에서는 운영자가 운영 Dashboard에서 동일한 미참석 처리 작업을 수동 실행할 수 있습니다.

`NOT_ATTENDED`는 예정된 상담이 종료되었지만 상담 기록이 시작되지 않아 시스템에서 상담 수행을 확인할 수 없는 상태입니다. 외부에서 고객 불참이 확인되었다는 의미는 아닙니다.

`NO_SHOW`는 향후 CTI 연계 등으로 실제 고객 불참을 명시적으로 확인할 수 있는 경우를 위한 상태입니다.

### Frontend API URL

`API_URL`은 Frontend Bundle Build 과정에서 포함됩니다.

값을 변경한 경우 GitHub Pages Frontend를 다시 Build하고 배포해야 합니다.

### GitHub Pages URL

Custom Domain을 사용하지 않으면 기본 URL 형식은 다음과 같습니다.

```text
https://<owner>.github.io/<repo>/
```

현재 Repository에서는 다음 주소를 사용합니다.

```text
https://jyonyve.github.io/allosta/
```

## 배포 확인

배포 후 다음을 확인합니다.

1. GitHub Pages URL에 접속합니다.
2. Seed된 Demo Account로 로그인합니다.
3. 고객, 상담사, 운영자 Workspace가 정상 동작하는지 확인합니다.
4. Render Health Endpoint를 확인합니다.

```text
https://alostar-api.onrender.com/
```

5. GitHub Actions의 CI 및 Pages Deployment Workflow가 모두 성공했는지 확인합니다.
