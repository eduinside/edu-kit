# 수업꾸러미(edu-kit) 구현 계획서

작성일: 2026-06-26

> 본 문서는 핸드오프 자료(`_prototype/design_handoff_수업꾸러미/`의 README.md · DATA_MODEL.md · SAMPLE_DATA.md · 수업꾸러미.dc.html)와, 제품 오너가 확정한 4개 핵심 결정을 하나의 실행 가능한 계획으로 통합한 것이다. 실무자가 이 문서만으로 착수할 수 있도록 데이터 스키마, 콘텐츠 파이프라인, 라우트 표, 디자인 토큰, 디렉터리 구조, 단계별 마일스톤을 모두 포함한다.

## 0. 확정 결정 (이 계획의 전제)

| # | 결정 | 값 | 영향 |
|---|---|---|---|
| **C1** | 콘텐츠 저작·딜리버리 | **Google Sheet → 정적 JSON → GitHub → Cloudflare Pages 자동 배포** | 콘텐츠는 빌드 산출물(정적 JSON). 런타임 콘텐츠 DB·어드민 UI 불필요. ISR 불필요(변경 시 재빌드로 신선도 달성) |
| **C5** | 발행 트리거 | **시트 안 "발행" 버튼(Google Apps Script)** — GitHub Actions 미사용 | GAS는 시트→`data/raw/*.json` GitHub 커밋만(단순). 변환·검증·새니타이즈는 Pages 빌드 스텝(TS). Actions 러너 복잡성 회피 |
| **C2** | 호스팅·스택 | **Cloudflare(에듀링크 동일 스택)** — Pages + Functions + KV + R2, React Router 7 + Tailwind 4 + HeroUI + lucide-react | edu-link과 인프라·디자인시스템 공유 |
| **C3** | 레포 구성 | **단독 레포(현 `eduinside/edu-kit`) + edu-link 디자인시스템 재사용** | ⚠️ edu-link 실측 결과 **모노레포 아님**(npm 단일 앱). 공유 자산은 `edu-link/src/client/index.css`(토큰+HeroUI accent, ~83줄)뿐 → **복사 재사용**. edu-link 변경 없음. 모노레포 전환은 과투자라 미적용(§3.3) |
| **C4** | 작성 주체·권한 | **중앙 편집팀**(소수 신뢰 편집자) | 인앱 어드민 로그인·교육청 SSO 불필요. 편집 표면 = Google Sheet 공유 + GitHub PR. **이전 초안의 'SSO 연동 차단 리스크'는 소멸** |

> **이전 초안 대비 변경 요약**: (구안) D1 런타임 + 어드민 UI + Cloudflare Access/교육청 SSO + Worker SSR → **(확정) 정적 JSON + 시트 파이프라인 + Pages 정적 배포 + 무(無)인앱인증**. D1은 폐기가 아니라 **콘텐츠 논리 스키마이자 향후 이전 타깃**(§5·§12)으로 보존한다.
> **모노레포 재검토(2026-06-26 실측)**: edu-link은 모노레포가 아닌 **npm 단일 앱**으로 확인됨 → C3을 "모노레포 편입"에서 **"단독 레포 + edu-link 토큰 CSS 재사용"** 으로 정정. 공유 표면이 CSS 한 파일이라 모노레포 전환은 하지 않는다(§3.3).

---

## 1. 개요

### 1.1 배경
**수업꾸러미**는 대구광역시교육청 교사가 *학년·학기·교과·단원*으로 수업 콘텐츠 묶음("꾸러미")을 찾아, 한 화면에서 영상·이미지·읽기자료·활동을 순서대로 보는 웹 서비스다. 각 꾸러미는 짧은 링크 `kit.dgedu.link/<shortId>`로 공유되며 조회수·좋아요로 활용도를 추적한다.

핸드오프는 **하이파이 디자인 프로토타입**(`수업꾸러미.dc.html`)이며 콘텐츠(KITS/CONTENT)가 코드에 하드코딩돼 있다. 즉 디자인·데이터 구조·샘플 데이터는 확정됐으나, (1) 실제 앱 구현과 (2) 중앙 편집팀의 저작·발행 체계가 비어 있다 — 본 계획이 이 둘을 채운다.

### 1.2 목표
- 프로토타입의 디자인·인터랙션을 에듀링크 스택으로 픽셀에 가깝게 재현한다(모노레포 공유 디자인시스템 사용).
- 콘텐츠를 코드 하드코딩에서 **Google Sheet 저작 → 정적 JSON 빌드 → Git 버전관리 → Pages 자동 배포** 파이프라인으로 옮겨, 중앙 편집팀이 시트만 고치고 발행하면 사이트가 갱신되게 한다.
- 짧은 링크 공유와 OG 카드 미리보기를 1급 기능으로 보장한다(빌드 타임 prerender).
- 조회수·좋아요를 어뷰징에 강건하게 집계한다(런타임 Functions + KV).
- 공공 서비스로서 웹접근성(KWCAG)과 보안(저장형 XSS 방지)을 처음부터 내장한다.

### 1.3 핵심 가치
1. **찾기 쉬움** — 학년·학기·교과·단원 4단 필터로 즉시 도달.
2. **한 화면 학습 흐름** — 활동형/흐름형 두 구조를 좌측 목차 + 우측 본문으로 제시.
3. **공유 가능** — 짧은 링크 + OG 카드로 교사 간 전파(카카오톡/슬랙 등).
4. **가볍게 운영** — 중앙 편집팀이 익숙한 스프레드시트로 저작, Git/PR로 검수·이력·롤백.

### 1.4 범위 (In / Out of scope)

**In scope**
- 홈 갤러리(필터 + 카드 그리드), 꾸러미 뷰어(목차 + 4타입 본문), 데이터 구조 모달.
- 두 흐름: 활동형(`단원안내→생각열기→탐구하기→확장하기`), 핵심용어 흐름형(`도입→전개→정리`).
- 콘텐츠 타입: intro / video / image / text(위지윅 HTML).
- 콘텐츠 논리 스키마(JSON 형상), 시트→JSON ETL/검증/새니타이즈, shortId, 조회수·좋아요 런타임 집계.
- 짧은 링크 라우팅 + OG 메타/이미지, 보안·성능·접근성·관측·CI/CD.
- 단독 레포 + edu-link 디자인 토큰(CSS) 재사용으로 디자인시스템 일치.

**Out of scope (현 단계)**
- **인앱 어드민 UI / 교육청 SSO / 교사별 계정**(C4 — 저작은 Google Sheet + GitHub PR로 수행).
- 런타임 콘텐츠 DB(D1) — 콘텐츠는 정적 JSON. D1은 향후 이전 타깃으로만 설계 보존(§12 D-A).
- 다국어 풀 프레임워크(UI 문자열 분리만), 댓글·평점·즐겨찾기, 교사 개인 대시보드, 모바일 네이티브 앱.

### 1.5 비목표 (Non-goals)
- 프로토타입 마크업을 그대로 복사·배포하지 않는다(`support.js` 런타임 의존). 로직·데이터 구조만 참고, 마크업은 공유 디자인시스템으로 재작성.
- 해시 라우팅(`#/...`)을 유지하지 않는다 — OG 공유가 핵심이라 **경로 기반 라우팅 + 빌드 타임 prerender**로 전환.
- 즉시 발행(초 단위)을 보장하지 않는다 — 발행 = 빌드(수 분). 중앙 편집팀 발행 주기에 무해(§12 R-빌드지연).

---

## 2. 사용자 & 핵심 시나리오

### 2.1 역할
| 역할 | 접근 경로 | 권한 |
|---|---|---|
| **교사(소비자)** | 무인증 공개 웹 | 홈 탐색, 뷰어 열람, 좋아요, 링크 복사·공유 |
| **편집자(중앙 편집팀)** | **Google Sheet 공유 권한**(Workspace) + 발행 트리거 | 시트에서 꾸러미/항목 작성·수정 |
| **검수자/관리자** | **GitHub 저장소 권한** | 발행 PR 리뷰·머지, Pages Preview로 검수 |

> 인증/인가는 **앱이 아니라 Google(시트 공유) + GitHub(저장소 권한)** 가 담당한다. 앱에는 로그인 화면이 없다 — 공개 읽기 전용 사이트 + 런타임 카운트 API뿐.

### 2.2 핵심 시나리오

**S1. 교사 — 수업 자료 찾기(소비)**
1. 홈(`/`) 진입 → 학년 5 · 2학기 · 사회 선택(필터 변경 시 단원은 `전체`로 리셋).
2. 대단원 칩(`옛사람들의 삶과 문화`) 선택 → 조건에 맞는 카드 그리드 표시.
3. `선사 시대와 고조선` 카드 클릭 → 뷰어(`/k/ab12`) 진입, 첫 항목 자동 선택.
4. 좌측 목차에서 단계·항목 이동, 우측 본문(개요/영상/이미지/글) 열람.
5. 좋아요 토글, `링크 복사` → `https://kit.dgedu.link/ab12` 클립보드 복사.

**S2. 편집자 — 꾸러미 저작·발행(저작)** — *핵심 운영 흐름*
1. 중앙 편집팀이 **Google Sheet**(`kits`/`items`/`stage_meta` 탭)에 행을 추가/수정. 메타·stage·항목·영상 URL·구간·이미지 URL·본문(마크다운)을 입력.
2. 시트 안 **"발행" 버튼** 클릭 → **Apps Script(GAS)** 가 3탭을 직렬화해 GitHub `data/raw/*.json`으로 커밋(GitHub Actions 미사용).
3. push 감지 → **Cloudflare Pages 빌드**가 `scripts/sheet-to-json.ts`(prebuild)로 컬럼 정규화·zod 검증·마크다운→HTML·새니타이즈 → 정본 `data/*.json` 산출 → 정적 빌드. **검증 실패 시 빌드 중단(배포 안 됨)**.
4. 빌드 성공 → **Pages 자동 배포** → 사이트 갱신(수 분). (검수 모드 선택 시: `content` 브랜치 Preview 확인 후 머지)

**S3. 공유 흐름(전파)**
1. 교사가 뷰어에서 `링크 복사` → 메신저(카카오톡/슬랙)에 붙여넣기.
2. 메신저 봇이 `kit.dgedu.link/ab12`를 크롤 → **빌드 타임 prerender된 kit별 OG 메타**(제목·설명·OG 이미지)를 HTML에서 읽어 카드 미리보기 표시(JS 미실행 봇도 OK).
3. 수신 교사가 링크 클릭 → 뷰어 진입(조회수 +1, visitorId dedupe).

---

## 3. 기술 스택 & 선정 근거

### 3.1 확정 스택
| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **React 19 + React Router 7 (framework mode)** | edu-link 동일. 경로 라우팅 + **빌드 타임 prerender(SSG)** 로 OG 메타/정적 페이지 확보 |
| 빌드/배포 | **Vite + Cloudflare Pages (Git 연동)** | push→자동 빌드·배포, PR마다 Preview URL, 정적 자산 엣지 서빙 |
| 런타임(동적) | **Cloudflare Pages Functions** | 조회수·좋아요 API(유일한 런타임 경로) + 단축링크 처리 |
| 스타일 | **TailwindCSS 4** | 디자인 토큰을 `@theme`로 매핑, 프로토타입 CSS 변수와 1:1 |
| UI 컴포넌트 | **HeroUI** (모노레포 공유 래퍼) | Button/Card/Chip/Input/Modal 등. Modal이 포커스 트랩·Escape·aria-modal 기본 지원 |
| 아이콘 | **lucide-react** | 프로토타입 인라인 SVG를 개별 import로 트리셰이킹 교체 |
| 콘텐츠 저장 | **정적 JSON**(`data/*.json`, Git 버전관리) | C1. 런타임 DB 없이 읽기 비용 0, 이력·롤백·PR 검수 |
| 카운터 저장 | **Cloudflare KV** (조회 dedupe·집계, 좋아요 토글) | 교사 스케일 저QPS에 충분, 인프라 최소. 고QPS 시 Durable Object 승격 |
| 이미지 저장 | **Cloudflare R2 + Images(`/cdn-cgi/image/`)** | 유물 이미지 미러·리사이즈·WebP/AVIF (바이너리는 Git에 안 둠) |
| 콘텐츠 파이프라인 | **시트 "발행" 버튼(Google Apps Script) → GitHub 커밋 → Pages 빌드** (GitHub Actions 미사용) | 편집자가 시트를 안 떠남, Actions 러너 불필요(복잡성↓). 변환·검증은 Pages 빌드 스텝(TS) |
| 본문 변환·새니타이즈 | **Pages 빌드 스텝**: 마크다운→HTML(unified/remark) + sanitize(`ultrahtml`/`sanitize-html`) + DOMPurify [클라] | 빌드 타임 정제(GAS 아님) + 렌더 타임 이중 방어 |
| 폰트 | **Pretendard (woff2 subset)** | 디자인 시스템 단일 패밀리 |
| 테스트 | **Vitest + @cloudflare/vitest-pool-workers + Playwright + axe-core** | 단위/통합(Functions)/E2E/접근성 |
| 관측 | **Sentry + Workers Analytics Engine + Pages/Logpush** | 에러·사용통계·로그 |
| 레포/디자인 공유 | **단독 레포 + edu-link `index.css` 토큰 복사 재사용** (모노레포 미사용 — edu-link은 npm 단일 앱) | 공유 면이 작아 모노레포 과투자. 동일 dep 버전 핀으로 동작 일치(§3.3) |

### 3.2 대안과 트레이드오프
| 결정 지점 | 채택 | 대안 | 트레이드오프 |
|---|---|---|---|
| 콘텐츠 소스 | **정적 JSON(시트→빌드)** | D1 런타임 / 헤드리스 CMS | 콘텐츠가 작고 발행이 가끔이며 편집팀이 시트에 익숙 → 정적이 가장 단순·저비용·이력보존. 운영 규모↑ 시 D1 이전(§12 D-A) |
| 신선도 | **변경 시 재빌드(Pages)** | Next.js ISR(Vercel·edumaps 방식) / 런타임 KV 스냅샷 | ISR DX는 좋으나 edu-link CF 스택/모노레포와 분리됨. 재빌드(수 분)는 발행 주기에 무해하고 인프라가 단순 |
| 배포 | **Cloudflare Pages(Git 연동)** | Workers + Static Assets(`wrangler deploy`) | Pages Git 연동이 push 자동배포·Preview에 가장 직접적. (둘 다 Cloudflare — 추후 Workers Static Assets로 이관 가능) |
| 저작 표면 | **Google Sheet + GitHub PR** | 인앱 어드민 CRUD / MDX-only | 비개발 편집팀 친숙 + Git 이력·검수. 인앱 어드민은 인증·CRUD·위지윅 구현비 최대(C4로 불채택) |
| 본문 입력 | **시트 셀에 마크다운 → 빌드 변환** | 셀에 raw HTML / 위지윅 에디터 | 시트에서 HTML 직접 작성은 고통. 마크다운+제한 문법이 편집팀에 현실적, 빌드가 `.sk-rich` HTML로 변환·새니타이즈 |
| 카운터 | **KV (+Functions)** | D1 / Durable Object | 순수 카운트엔 KV가 최소 인프라. 좋아요 멱등은 per-visitor 키로. 원자성/고QPS 필요 시 DO 승격 |
| 라우팅 | **경로 기반 + prerender** | 해시 라우팅 유지 | 해시는 서버 전송 안 됨 → OG 불가. 공유가 핵심이라 경로 전환은 선결 |

### 3.3 디자인시스템 공유 전략 (C3 — edu-link 실측 반영)
> **실측 결과(2026-06-26)**: `D:/Hwan/Documents/Web/edu-link`은 **모노레포가 아니라 npm 단일 앱**이다(`pnpm-workspace.yaml`/`turbo.json` 없음, `package-lock.json`, `src/client`+`src/server` 구조, Hono+Cloudflare Workers). 따라서 "모노레포 편입(pnpm+Turbo)"은 **불성립** — 운영 중인 edu-link을 모노레포로 전환하지 않는다.

- **edu-link 스택(실측)**: React 19, `react-router-dom` 7.15, Tailwind 4(`@tailwindcss/vite`), **HeroUI 3**(`@heroui/react`·`@heroui/styles`), `lucide-react` 1.16, `framer-motion`, Hono, Cloudflare Workers(`@cloudflare/vite-plugin`+wrangler). → 프로토타입이 말한 "에듀링크 스택"과 동일.
- **실제 공유 자산 = CSS 한 파일**: `edu-link/src/client/index.css`(~83줄):
  - `@import "tailwindcss"` + `@import "@heroui/styles"`
  - `@theme` 토큰: `--color-brand-50…900`(brand-500 `#3692ff`/brand-600 `#1f7af0`), `--color-primary #1f7af0`, `--color-ink/-soft/-faint`, `--color-paper #f3f5f9`, `--color-line #e2e6ee`, Pretendard `--font-sans/-display`. (토큰 출처: `school-portal-r2`)
  - **HeroUI v3 accent override**: `:root{--accent:#1f7af0; --accent-hover:#1763d0}` → 모든 HeroUI primary 표면을 Codeit blue로 리브랜드.
  - 유틸: `.gemini-gradient-bg`, `.glassmorphism(-dark)`, 스크롤바.
  - → **프로토타입 토큰(§7.4)과 정확히 일치**(brand-600 `#1f7af0`, paper `#f3f5f9`, gemini gradient, glassmorphism 모두 확인).
- **전략(권장)**: edu-kit은 **단독 레포**(현 `eduinside/edu-kit`)로 두고, 위 `index.css`를 **복사 재사용** + 동일 dependency 버전 핀(HeroUI 3 / RR7 / Tailwind 4 / lucide 1.16) + 단계 색·교과 팔레트(§7.4) 추가. HeroUI accent override 패턴 그대로 사용.
- **edu-link 변경: 없음**(읽기만). 공유 면이 CSS 한 파일이라 모노레포 전환은 과투자.
- **향후**: 공유 컴포넌트가 늘어 드리프트가 부담되면 토큰/테마를 작은 패키지(`@eduinside/design-tokens`)로 추출해 양쪽이 의존(모노레포 없이도 단일 출처 확보). §12 D-모노레포.

---

## 4. 시스템 아키텍처

### 4.1 콘텐츠 파이프라인 (빌드 타임) — GitHub Actions 미사용(D-트리거)
> 트리거는 **시트 안의 "발행" 버튼(Google Apps Script)**. GAS는 가볍게 *시트→원본 JSON 커밋*만 하고, 무거운 변환·검증·새니타이즈는 **Cloudflare Pages 빌드 스텝(TypeScript)** 에서 처리한다. 별도 GitHub Actions 러너 없음.
```
[Google Sheet]  kits / items / stage_meta 탭   ← 중앙 편집팀 편집(Workspace 공유)
      │  ① "발행" 버튼 클릭 → Apps Script(GAS) 실행
      ▼
[GAS — 가벼운 작업만]
      │  - 시트 3탭을 그대로 직렬화(원본 스냅샷)
      │  - GitHub Contents API로 data/raw/{kits,items,stage_meta}.json 커밋
      │    (PAT는 Script Properties에 보관, 변환·검증 로직 없음 → GAS 단순)
      ▼
[GitHub repo (data/raw/*.json)]  ← 원본 스냅샷 버전관리(이력·롤백)
      │  ② push 감지 → Pages 빌드 시작
      ▼
[Cloudflare Pages 빌드 (prebuild = scripts/sheet-to-json.ts, TS)]
      │  - field-map 정규화(dae→unit, ready→published …)  §5.0
      │  - zod 스키마 검증(enum/필수/타입) — 실패 시 빌드 중단(배포 안 됨)
      │  - concepts ";" → 배열, 흐름형 매핑 §5.3, 마크다운→HTML(.sk-rich)→새니타이즈 §9.1
      │  - 검증·정제된 data/*.json 산출 → Vite/RR7 빌드(정적 + kit별 prerender + OG)
      ▼
[Cloudflare Pages]  엣지 배포 (수 분)
```
> 검수 모드(선택): GAS가 `content` 브랜치에 커밋하면 Pages **Preview** 배포 → 검수자가 GitHub에서 머지(또는 "프로덕션 반영" 2차 버튼) 시 Production. 기본은 단순화를 위해 `main` 직접 커밋 + **빌드 검증 게이트**로 안전성 확보.

### 4.2 런타임 (요청 시)
```
   교사(브라우저)
   ────────────
   GET kit.dgedu.link/ab12 ─▶ [단축링크] /ab12 → /k/ab12 로 리라이트/리다이렉트
                              (Bulk Redirects 또는 _redirects / 경량 Function — DB 조회 불필요)
   GET /k/ab12             ─▶ Pages 엣지: 빌드 타임 prerender된 정적 HTML(+OG 메타) 반환 (읽기 비용 0)
                              클라가 data/*.json(또는 인라인 데이터)로 하이드레이트
   POST /api/kits/ab12/view ─▶ [Pages Function] visitorId 쿠키 → KV dedupe(TTL 12h) → KV views +1
   POST /api/kits/ab12/like ─▶ [Pages Function] KV like:<kit>:<visitor> 토글(멱등) → KV likes ±1
   GET  /api/kits/ab12/stats─▶ [Pages Function] KV views/likes 반환 (no-store)
                                            │
                                      ┌─────▼─────┐        ┌───────────┐
                                      │    KV     │        │    R2     │
                                      │ views:*   │        │ 이미지/OG │
                                      │ likes:*   │        └───────────┘
                                      │ view:* TTL│
                                      │ like:* set│
                                      └───────────┘
```

### 4.3 핵심 원칙
- **콘텐츠 정적 / 카운트 동적 분리**: 콘텐츠는 빌드 산출물(정적, 캐시 영구), 카운트만 Function + KV(`no-store`). 카운트가 바뀌어도 콘텐츠 캐시는 불변.
- **신선도 = 재빌드**: 시트 변경 → Action → 커밋 → Pages 재배포. ISR/런타임 재검증 불필요.
- **클라이언트 합성**: 정적 콘텐츠 + 실시간 stats를 합성. 좋아요/조회는 낙관적 업데이트(`likesAdd`/`viewsAdd` 델타) 후 stats로 정정.
- **이미지/OG 바이너리는 Git 밖**: R2에 두고 URL 참조. OG 이미지는 빌드 타임 생성→R2/정적 자산.

### 4.4 배포 토폴로지
- **Cloudflare Pages** 프로젝트 1개(정적 + Functions). 레포 루트 빌드(`pnpm build`).
- **환경**: Production(main) / Preview(PR마다 자동 URL). 환경별 KV·R2 바인딩 분리.
- **단축 도메인**: `kit.dgedu.link` → Pages 프로젝트에 커스텀 도메인 연결. `/<id>`→`/k/<id>` 리라이트.
- 시크릿: **GitHub PAT는 GAS Script Properties**(발행 커밋용), Pages 환경변수는 런타임 최소(없으면 0). GAS가 시트를 직접 읽으므로 Sheets 서비스계정 키 불필요.

---

## 5. 데이터 모델 & 저장소

> 콘텐츠는 **정적 JSON**이 1차 저장소다. 아래 스키마는 **(a) JSON의 논리 형상**이자 **(b) 향후 D1 이전 시 그대로 쓰는 DDL**이다(§12 D-A). 시트 컬럼 → JSON 필드 정규화는 `scripts/field-map.ts` 한 곳에 둔다.

### 5.0 필드명 정본화 (중요)
프로토타입·DATA_MODEL.md·모달 `itemCols` 명세가 불일치한다. **DATA_MODEL.md를 정본**으로 단일 매핑을 고정한다.

| 프로토타입/시트 | 정본(JSON/스키마) | 비고 |
|---|---|---|
| `dae` | `unit` | 대단원명 |
| `daeNo` | `unit_no` | 대단원 번호 |
| `ready` | `published` | 공개 여부 |
| `order` | `sort_order` | `order`는 SQL 예약어(향후 D1 대비) |
| `imgLabel` / `imgSub` | `image_label` / `image_sub` | |
| `html` | `body` | 위지윅 HTML(빌드 산출) |
| `vTitle` / `vDesc` | `video_title` / `video_desc` | |
| `videoId` | `video_id` | URL은 `video_url` 별도 |
| `'단원 안내'`(공백) | `단원안내`(공백 없음) | **stage 라벨 정본 = 공백 없음** |
| 모달 `keyword` | `title`에 흡수 | 흐름형 핵심용어 = `title`(별도 컬럼 없음) |

> 주의1: STAGE 색 매핑·시트·JSON 모두 `단원안내`(공백 없음)로 통일.
> 주의2: 흐름형 핵심용어는 `items.title`로 정규화한다(별도 `keyword` 컬럼 없음). 모달 안내문은 "흐름형 핵심용어는 title로 저장"으로 정정.

### 5.1 kits — 꾸러미 메타 (JSON 형상 / D1 DDL)
```jsonc
// data/kits.json — 배열
{
  "id": "ab12",            // shortId, 4자 base31. 라우트 :kitId와 동일 값
  "title": "선사 시대와 고조선",
  "grade": 5,              // 3|4|5|6
  "sem": "2학기",          // 1학기|2학기
  "subject": "사회",       // 사회|과학 (썸네일 색·아이콘 결정)
  "unit": "옛사람들의 삶과 문화",
  "unit_no": 1,
  "flow": "activity",      // activity|flow
  "sort_order": 1,         // 갤러리 정렬 + 교과 팔레트 회전 인덱스
  "published": true
  // views/likes는 정적 JSON에 두지 않음 — 런타임 KV (§8). 초기값만 seed 가능
}
```
```sql
-- 향후 D1 이전 타깃(동일 스키마)
CREATE TABLE kits (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK(grade IN (3,4,5,6)),
  sem TEXT NOT NULL CHECK(sem IN ('1학기','2학기')),
  subject TEXT NOT NULL CHECK(subject IN ('사회','과학')),
  unit TEXT NOT NULL, unit_no INTEGER NOT NULL,
  flow TEXT NOT NULL CHECK(flow IN ('activity','flow')),
  sort_order INTEGER NOT NULL, published INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_kits_scope ON kits(grade, sem, subject, unit, sort_order);
```
근거: 홈 필터는 `grade && sem && subject` 1차 → `unit` 2차 → `sort_order` 정렬(프로토타입 `homeVals()`). 정적 JSON에선 클라가 필터링, D1 이전 시 복합 인덱스가 동일 경로 커버.

### 5.2 items — 콘텐츠 항목 (sparse, 타입별 필드)
```jsonc
// data/items.json — 배열 (꾸러미당 여러 행)
{
  "id": "ab12_v1", "kit_id": "ab12",
  "item_key": "v1",          // 항목 키 — URL /k/:kitId/:itemId 의 itemId
  "stage": "생각열기",        // 단원안내|생각열기|탐구하기|확장하기 | 도입|전개|정리
  "type": "video",           // intro|video|image|text
  "title": "구석기 사람들의 하루",   // 흐름형은 핵심용어가 title
  "description": "뗀석기로 사냥하고 채집하던 생활",
  "sort_order": 1,
  // intro 전용: core_idea, core_question, concepts[], standard_code, standard_text
  // video 전용: video_url, video_id, video_title, video_desc, start_sec, end_sec, video_license, video_channel
  // image 전용: image_url, image_label, image_sub, image_source, image_license
  // video/image 공용: caption
  // text 전용: body  (마크다운→.sk-rich HTML, 빌드 새니타이즈 완료본)
}
```
- D1 이전 시: 단일 테이블 + 타입별 NULL 컬럼(타입 4개 고정·행 수천 단위 → 서브테이블/JSON payload는 과설계). `concepts`만 JSON 배열 문자열. `UNIQUE(kit_id, item_key)`, `INDEX(kit_id, stage, sort_order)`.
- `item_key`는 URL itemId(intro,v1,t1,f1…)와 매핑되므로 보존 필수. `image_source/license`·`video_license`는 저작권 메타(공공 서비스 필수).

> **흐름형(flow) 컬럼 매핑 규칙 (중요)**: 프로토타입 `flowGroups()`(556행)는 한 행에서 `title=핵심용어(kw)`, `description=영상제목(vt)`, `video_title=영상제목(vt, description과 동일값)`, `video_desc=영상설명(vd)`를 동시 설정한다. 즉 **영상제목 한 값이 `description`과 `video_title` 두 필드에 의도적 중복**된다. 흐름형 item 채우기:
> - `title` ← 핵심용어(kw) / `description` ← 영상제목(vt) / `video_title` ← 영상제목(vt, **description과 동일**) / `video_desc` ← 영상설명(vd)
> - `type='video'` 고정, `video_id`(데모 `aqz-KE-bpKQ` → 실URL 교체 TODO), 그 외 컬럼 NULL.
> - 활동형은 `description`≠`video_title`이므로 이 규칙은 flow형에만 적용. ETL이 이 매핑을 그대로 구현해야 흐름형 7행이 올바르게 채워진다.

### 5.3 stage_meta — 탐구질문 정규화
```jsonc
// data/stage_meta.json — 배열
{ "kit_id": "ab12", "stage": "생각열기", "question": "도구가 달라지면 삶도 달라질까?", "sort_order": 2 }
```
- question은 항목이 아니라 **stage 그룹 속성**이다. 항목마다 중복하면 정합성이 깨지므로 분리.
- **단원안내 stage는 question=null**(프로토타입 `question=''` → null 정규화). flow형(도입/전개/정리)도 전부 null. question이 채워지는 건 활동형 생각열기/탐구하기/확장하기뿐.

### 5.4 카운터 (KV) — 조회수·좋아요
콘텐츠가 정적이므로 카운트만 런타임. **KV**에 보관(D1 불필요):
| 키 | 값 | 용도 |
|---|---|---|
| `views:<kitId>` | integer | 누적 조회수 |
| `likes:<kitId>` | integer | 누적 좋아요 |
| `view:<kitId>:<visitorId>` | "1" (TTL 12h) | 조회 dedupe |
| `like:<kitId>:<visitorId>` | "1" | 좋아요 1인 1표(멱등 토글) |
- 좋아요 ON: `like:*` 키 없으면 생성 + `likes` +1, 있으면 무시. OFF: 키 삭제 + `likes` −1.
- 초기값: seed 스크립트로 SAMPLE_DATA의 views/likes를 KV에 적재(없으면 0).
- **원자성/고QPS 주의**: KV는 최종일관성. 교사 스케일 저QPS엔 충분하나, 동시 쓰기 경합/정확 카운트가 필요해지면 **Durable Object**(카운터)로 승격(§12 R-카운터).

### 5.5 shortId 발급 규칙
> **동일성**: `kits.id` == `shortId` == 라우트 `:kitId` 는 모두 같은 값(별도 단축링크 테이블·리졸버 없음). `kit.dgedu.link/<id>` ↔ `/k/<id>`.
- **알파벳**: 혼동문자 제외 base31 `23456789abcdefghijkmnpqrstuvwxyz`(0/O,1/l/I 제거). 4자 ≈ 92만 조합.
- **발급 위치**: 신규 꾸러미는 시트에 행 추가 시 `id` 칸을 비워두면 **빌드 Action이 미발급 행에 base31 4자 랜덤 생성 후 시트에 다시 기록**(또는 편집자가 수동 입력). 빌드는 JSON 내 `id` 유일성을 검증(중복 시 실패).
- 시드 `ab12`/`cd34` 등 기존 id 유지. 충돌 잦으면 5자 확장. 욕설·혼동어 블랙리스트.
- 근거: 교사가 구두/판서 공유 → 혼동문자 제외가 오입력 방지.

### 5.6 빌드/캐시 전략
| 자원 | 처리 | 캐시 |
|---|---|---|
| 홈 `/` | 빌드 타임 정적 페이지(전체 kits 데이터 인라인/번들) | 엣지 영구 캐시(immutable, 해시 파일명) |
| 뷰어 `/k/:kitId` | **kit별 빌드 타임 prerender**(OG 메타 포함) | 엣지 영구 |
| `data/*.json` | 정적 자산 | 엣지 영구(빌드마다 새 해시) |
| `/api/.../stats|view|like` | Pages Function | `no-store` |
- 발행 = 재배포이므로 별도 무효화 로직 불필요(새 배포가 캐시 교체).

### 5.7 시드 / ETL
- **시드(초기)**: SAMPLE_DATA.md를 `data/*.json`으로 직접 커밋(ab12 활동형 8항목 + cd34 흐름형 7항목 + kits 13행 + stage_meta). 영상은 데모 ID `aqz-KE-bpKQ`(실URL 교체 TODO).
- **text body 2건(`t8jo`·`tDangun`)**: 원본 HTML은 인라인 style·div 박스를 포함하므로 "그대로"가 아니라 **마크다운(또는 정제 HTML) → `.sk-rich`/`.sk-callout` class 구조로 변환 → 새니타이즈(§9.1) → JSON**. 변환 후에도 박스 디자인(💡/🔎)이 보존되도록 한다.
- **ETL(`scripts/sheet-to-json.ts` + `field-map.ts`)**: `data/raw/*.json`(GAS가 커밋한 시트 원본) 읽기 → 컬럼 정규화(dae→unit 등) → concepts `;`→배열 → 흐름형 매핑(§5.2) → 본문 변환·새니타이즈 → zod 검증 → `data/*.json` write. **Pages 빌드 prebuild**와 로컬(`pnpm sync`) 양쪽에서 동일 코드 사용(GitHub Actions 아님).

---

## 6. 콘텐츠 저작/운영 전략 (핵심)

핸드오프의 "중요한 공백": 프로토타입은 콘텐츠가 코드 하드코딩. 본 계획은 이를 **Google Sheet 저작 → Git 버전관리 → Pages 자동 배포**로 채운다(C1·C4).

### 6.1 왜 이 방식인가
- 중앙 편집팀이 **스프레드시트에 익숙** → 학습 곡선 최소, 인앱 어드민 구현비 0.
- 콘텐츠가 **Git에 버전관리** → diff·이력·롤백, **PR 리뷰 + Pages Preview로 검수**(핸드오프가 요구한 검수 워크플로를 인프라가 공짜 제공).
- **빌드 타임이 검증·새니타이즈의 자연 지점** → 스키마 오류·XSS를 배포 전 차단.
- 런타임 콘텐츠 DB·로그인 불필요 → 인프라/공격면 최소.

### 6.2 Google Sheet 구조
3개 탭(= JSON 3파일):
- **`kits`** 탭: `id, title, grade, sem, subject, unit, unit_no, flow, sort_order, published` (+ 선택 `og_image`).
- **`items`** 탭: `kit_id, item_key, stage, type, title, description, sort_order` + 타입별 컬럼(`core_idea…`, `video_url/start_sec/end_sec/video_title/video_desc`, `image_url/image_label/image_sub/image_source/image_license`, `body`).
- **`stage_meta`** 탭: `kit_id, stage, question, sort_order`.
- 편의: 데이터 검증(드롭다운)으로 enum(grade/sem/subject/flow/type/stage) 오입력 방지. `concepts`는 `;` 구분. 본문은 **마크다운**(아래).

### 6.3 발행 파이프라인 — 시트 버튼(GAS), GitHub Actions 미사용
> **확정(D-트리거)**: 트리거는 **시트 안 "발행" 버튼**. GitHub Actions의 YAML/러너 복잡성을 피한다. 무거운 변환·검증·새니타이즈는 GAS가 아니라 **Pages 빌드 스텝(TS)** 이 담당해 로직을 레포에 두고 테스트한다.

1. **시트 버튼(GAS)** — 시트에 그림/이미지 버튼 + 스크립트 할당(또는 커스텀 메뉴 `발행`). 클릭 시 Apps Script가:
   - `kits`/`items`/`stage_meta` 3탭을 그대로 직렬화(원본 스냅샷, 변환 없음).
   - **GitHub Contents API**(PUT)로 `data/raw/*.json` 커밋. 기존 파일 `sha` 조회 후 갱신.
   - GitHub PAT(fine-grained, contents:write)는 GAS **Script Properties**에 보관. 스크립트는 ~50줄로 단순(파서·새니타이저 불필요).
2. **Pages 빌드 스텝(`scripts/sheet-to-json.ts`, prebuild)** — push 감지 후 Pages 빌드가 자동 실행:
   - `data/raw/*.json` 읽기 → `field-map` 정규화 → **zod 검증(실패 시 빌드 중단=배포 안 됨)** → concepts 분할 → 흐름형 매핑(§5.2) → 마크다운→HTML(.sk-rich)→새니타이즈(§9.1) → 검증·정제된 `data/*.json` 산출.
   - 곧바로 Vite/RR7 빌드(정적 + kit별 prerender + OG) → 엣지 배포.
3. **검수 모드(선택)**: GAS가 `content` 브랜치에 커밋하면 Pages **Preview** 배포 → 검수자 GitHub 머지/2차 버튼 시 Production. 기본은 단순화를 위해 `main` 직접 + 빌드 게이트.
4. **로컬 보조**: 개발자는 동일 변환을 `pnpm sync`로 로컬 실행 가능(같은 `sheet-to-json.ts` 재사용).

### 6.4 본문(text/intro) 입력 — 마크다운 in 셀
- 편집자는 시트 `body` 셀에 **제한 마크다운** 작성(`# ## 제목, **굵게**, 표, 목록, > 인용`, 그리고 `:::warn / :::info` 콜아웃 디렉티브). 빌드가 `.sk-rich`/`.sk-callout--warn|info` HTML로 변환 → 새니타이즈.
- 허용 인라인 HTML 없음(마크다운만) → raw HTML 작성 고통·XSS 표면 제거. 신뢰 편집팀이라도 빌드 새니타이즈는 항상 통과.
- 링크는 http(s)만 + `rel="noopener noreferrer" target="_blank"` 자동 부여.

### 6.5 이미지·영상 입력
- **이미지**: R2에 업로드(외부 핫링크 금지 — 안정성/저작권) 후 URL을 `image_url` 셀에 기입. `image_source`·`image_license`(공공누리/CC) 필수. 미지정 시 stage 색 placeholder로 graceful fallback. (R2 업로드는 간단한 업로드 유틸/`wrangler r2 object put` 또는 후속 미니 업로더.)
- **영상**: 전체 YouTube URL을 `video_url`에 → 빌드가 `video_id` 추출(`^[A-Za-z0-9_-]{11}$` 검증). `start_sec/end_sec` 구간, `video_title/video_desc`, `video_license`. 임베드는 `youtube-nocookie.com`.

### 6.6 검수·발행 거버넌스
- **기본(단순)**: GAS 버튼이 `main`에 직접 커밋 → Pages 빌드 게이트(zod 검증·새니타이즈 실패 시 배포 차단)가 1차 안전망. 중앙 편집팀 신뢰 전제.
- **검수 모드(선택)**: `content` 브랜치 커밋 → Pages Preview → 검수자 머지 시 Production(시각적 오류까지 사전 확인 필요할 때).
- 발행 게이트: 영상/이미지 **라이선스 미입력 행은 빌드 경고/실패**(공공 서비스 저작권 보호).
- 이력/롤백: Git 히스토리. 사고 시 직전 커밋으로 revert → 재배포.

---

## 7. 프론트엔드 설계

### 7.1 라우트 표
| 경로 | 화면 | 렌더 | 비고 |
|---|---|---|---|
| `/` | 홈 갤러리 | 빌드 정적 | 필터 + 카드 그리드(클라 필터링) |
| `/k/:kitId` | 뷰어(첫 항목 자동) | **kit별 prerender + OG** | |
| `/k/:kitId/:itemId` | 뷰어(특정 항목) | prerender + OG | itemId = items.item_key |
| `kit.dgedu.link/<id>` | 단축링크 | 리라이트/리다이렉트 | `id==kitId`(§5.5) → `/k/<id>` (DB 조회 없음) |
| `/api/kits/:id/stats` | 카운트 조회 | Function | no-store |
| `/api/kits/:id/view` `/like` | 카운트 쓰기 | Function | no-store |

데이터 구조 모달은 라우트가 아니라 홈 상태(`showData`)로 토글. **어드민 라우트 없음**(C4).

### 7.2 컴포넌트 트리
```
<App> (RR7 root, 헤더/토큰/폰트)  — 토큰은 edu-link index.css 복사(app/styles/tokens.css)
├── <HomeRoute>                          # /
│   ├── <Header>                         # 좌:로고+워드마크+kit.dgedu.link / 우:'데이터 구조' 버튼만 (교육청 라벨 없음 — README 25행)
│   ├── <IntroBlock>                     # pill 배지 + h1 + 서브카피
│   ├── <FilterCard>
│   │   ├── <SegmentedControl> ×3        # 학년/학기/교과
│   │   └── <UnitChips>                  # 전체 + 대단원 칩
│   ├── <ResultHeaderRow>                # "수업꾸러미 N개" + 컨텍스트
│   ├── <KitGrid> └ <KitCard> ×N         # 썸네일(gradient+배지+워터마크) + 메타 + 카운트
│   ├── <EmptyState>                     # 결과 없을 때
│   └── <DataModal>                      # showData 토글, HeroUI Modal
└── <ViewerRoute>                        # /k/:kitId/:itemId?
    ├── <ViewerTopbar>                   # 뒤로가기 + crumb + 제목 + 링크복사 + 조회수 + 좋아요
    ├── <Sidebar>                        # 학습흐름/핵심용어흐름 라벨 + 접기
    │   └── <StageGroup> ×N              # stage pill + 💡 question + <ItemButton>들
    └── <ContentPane>
        ├── <SubHeader>                  # sticky. [접힘 시] '목차' 버튼을 stage 행 좌측 인라인 → stage pill → question → 제목
        └── 타입 분기: <IntroContent> / <VideoContent>(lite-yt) / <ImageContent> / <TextContent>(.sk-rich) / <EmptyContent>
```

> **README '주의' 디자인 2건 (반드시 반영 — 되살리지 말 것)**:
> 1. **헤더 우측 교육청 라벨 없음**(README 25행): 우측엔 `데이터 구조` 버튼만. 교육청 정체성은 좌측 워드마크/`kit.dgedu.link`로 충분.
> 2. **사이드바 접힘 시 목차 버튼은 인라인, floating 금지**(README 45행, 프로토타입 238–243행): 접으면 `목차` 버튼이 `<SubHeader>` stage 행 좌측에 **인라인**으로(제목 안 가리게). `position:absolute`/floating 금지. 펼치면 사이드바 복귀.

### 7.3 HeroUI / Tailwind 매핑
| 프로토타입 요소 | 구현 |
|---|---|
| 필터 SegmentedControl | HeroUI Tabs(roving tabindex) 또는 커스텀 radiogroup(화살표 키) |
| 단원 칩 / 타입 배지 | HeroUI Chip + Tailwind 토큰 |
| 카드 | HeroUI Card + hover(`shadow-md`/border brand-200/`translateY(-3px)`) |
| 데이터 구조 모달 | HeroUI Modal(포커스 트랩·Escape·aria-modal·반환 포커스) |
| 버튼(링크복사/좋아요/뒤로) | HeroUI Button + `aria-pressed`/`aria-label` |
| 아이콘 | lucide-react 개별 import(eye, heart, link, chevron-left, chevrons-left, menu, x, play, image, landmark, flask-conical) |

### 7.4 디자인 토큰 (Tailwind 4 `@theme`, edu-link `index.css` 복사 + 추가)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-brand-50` | `#eff6ff` | 배경 약 |
| `--color-brand-500` | `#3692ff` | Codeit blue |
| `--color-brand-600` | `#1f7af0` | **primary** |
| `--color-brand-700` | `#1763d0` | hover |
| `--color-ink` | `#1f2937` | 본문 텍스트 |
| `--color-paper` | `#f3f5f9` | 뷰어 본문 배경 |
| `--color-line` | `#e2e6ee` | 경계선 |
| `--color-success` `--color-danger` `--color-warning` `--color-info` `--color-violet` | `#059669` `#e11d48` `#d97706` `#0284c7` `#7c3aed` | semantic(좋아요=danger, 생각열기=warning, image배지=violet) |

**교과 썸네일 팔레트(gradient `[from,to,accent]`, `sort_order` 회전)**
- 사회: `[#e0f2fe,#c7e0ff,#1f7af0]` · `[#eef2ff,#e0e7ff,#4f46e5]` · `[#ecfeff,#cffafe,#0369a1]`
- 과학: `[#d1fae5,#a7f3d0,#059669]` · `[#f0fdfa,#ccfbf1,#0d9488]` · `[#f0fdf4,#dcfce7,#16a34a]`

**단계 색(soft / text)**: 단원안내 slate-100/600 · 생각열기 warning-50/700 · 탐구하기 brand-50/700 · 확장하기 success-50/700 · 도입 `#f0f9ff`/`#0369a1` · 전개 brand-50/700 · 정리 success-50/700.
**Radius** 6(칩)·8(인풋/탭)·9999(pill)·12/13/14(카드)·16/18(모달/히어로). **Shadow** xs/sm/md/lg/xl + primary 글로우 `0 6px 18px rgba(31,122,240,.20)`. **Type** Pretendard 단일, 본문 500/라벨·제목 700/히어로·숫자 800/워드마크 900, mono=shortId·코드.

### 7.5 상태 관리
프로토타입 `this.state` → 매핑(URL이 라우팅 SoT):
- 홈 필터(`grade/semester/subject/unit`): **URL 쿼리스트링**(`?grade=5&sem=2학기&subject=사회&unit=…`)으로 딥링크·공유. 필터 변경 시 `unit`→`전체` 리셋.
- 뷰어 `selItem`: URL 경로(`/k/:kitId/:itemId`)가 SoT.
- `sidebarOpen`/`copied`/`showData`: 로컬 컴포넌트 상태.
- `liked`/`likesAdd`/`viewsAdd`: 낙관적 카운트. `liked` 초기값은 stats API(visitorId 기반) + localStorage 보조.

### 7.6 반응형 / 접근성
- **반응형**: 카드 그리드 `repeat(auto-fill, minmax(252px,1fr))`. 뷰어 사이드바 데스크톱 330px, 모바일 오버레이/접힘. 헤더 sticky 58px.
- **접근성(KWCAG/WCAG)**: 모달=HeroUI(포커스 트랩·Escape·aria-modal). 카드/필터 `div onClick`→`button`/`a`+키 핸들러. 좋아요 `aria-pressed`+`aria-label`, 복사 후 `aria-live="polite"`. 목차 `nav`+`aria-current`, 접기 `aria-expanded`. iframe `title`+`loading=lazy`. 캡션·메타는 slate-500↑(대비), axe-core CI 회귀 차단.

---

## 8. 조회수·좋아요 런타임 (Pages Functions + KV)

### 8.1 조회수
1. 뷰어 진입 → 클라 `POST /api/kits/:id/view`.
2. Function: `visitorId` 쿠키(없으면 발급, HttpOnly·Secure·SameSite=Lax) → KV `view:<kitId>:<visitorId>` 확인.
3. 없으면 KV에 TTL 12h 기록 + `views:<kitId>` +1. 있으면 스킵.
4. per-visitor rate limit(분당 N회 KV) + `cf.botManagement.score` 봇 1차 필터.
5. 클라는 `viewsAdd` 낙관적 +1, stats 응답으로 정정.

### 8.2 좋아요
1. 토글 → 즉시 `liked`/`likesAdd` 낙관적 반영.
2. `POST /api/kits/:id/like {on}`.
3. Function: `like:<kitId>:<visitorId>` 멱등 토글 → `likes:<kitId>` ±1.
4. 충돌 시 클라 롤백.

### 8.3 어뷰징 방지
- **dedupe 정본 키 = `visitorId` 단일**(KV TTL 12h). IP/UA는 dedupe 키가 아니라 rate-limit·봇 점수 보조 신호로만(쿠키 차단/시크릿 모드 과집계·과소집계 방지).
- 좋아요: per-visitor 키로 1인 1표(연타 무효).
- 봇 폭주 우려 시 의심 트래픽에 adaptive Turnstile(invisible).
- raw 이벤트(Analytics Engine)와 집계(KV) 분리 → 사후 보정 가능.
- **원자성 한계**: KV 최종일관성 — 동시 증가 누락 가능. 저QPS엔 허용, 정확/고QPS 필요 시 Durable Object 카운터로 승격.

---

## 9. 보안·성능·접근성·품질

### 9.1 위지윅 XSS — 2단계 새니타이즈
1. **빌드 시(Action)**: 시트 `body` 마크다운 → HTML 변환 후 **허용목록 화이트리스트**로 정제한 결과만 JSON에 기록. 허용 태그 `h3 h4 p strong em ul ol li table thead tbody tr th td a br span div blockquote`, 인라인 `style` 제거→`.sk-rich` class, `a`는 http(s)+`rel=noopener`. **`div`는 class 화이트리스트(`sk-callout`,`sk-callout--warn`,`sk-callout--info`)만**. 라이브러리: `unified`/`remark`(MD→HTML) + `sanitize-html`/`ultrahtml`(jsdom 비의존). 시드 t8jo/tDangun도 이 경로로 변환·정제.
2. **클라 렌더 시(React)**: 신뢰하더라도 DOMPurify 1회 더 통과 후 `dangerouslySetInnerHTML`. SVG는 lucide-react 정적 컴포넌트로 한정.
3. **CSP**: `script-src 'self'`, `frame-src https://www.youtube-nocookie.com`, `img-src` R2/허용 도메인, `style-src` 최소. XSS 통과해도 폭발 반경 제한.

### 9.2 인증·권한 (앱 외부)
- **앱에는 로그인이 없다**(C4). 공개 읽기 사이트 + 카운트 API.
- 저작 권한 = **Google Sheet 공유 + GitHub 저장소 권한**. 검수 = (선택) PR 머지 권한 또는 빌드 게이트.
- 파이프라인 시크릿 = **GitHub PAT**(fine-grained, contents:write) 1개를 **GAS Script Properties**에 보관. GAS가 시트를 직접 읽으므로 Sheets 서비스계정 키 불필요. 클라/런타임 노출 없음.
- 카운트 API 쓰기 보호: SameSite=Lax + Origin/Referer 화이트리스트 + rate limit(봇 어뷰징 한정).

### 9.3 성능
- **YouTube**: `react-lite-youtube-embed` 파사드(썸네일 먼저, 클릭 시 iframe). 뷰어는 1항목만 표시 → 선택 항목만 iframe. `nocookie` + `?rel=0&modestbranding=1` + start/end + `title`/`loading=lazy`.
- **이미지**: R2 + `/cdn-cgi/image/`(WebP/AVIF·리사이즈). `<img loading=lazy decoding=async width height srcset sizes>`.
- **번들**: RR7 코드 스플리팅(홈/뷰어). lucide 개별 import. DOMPurify는 text 청크 동적 import.
- **폰트**: Pretendard woff2 subset(KS X 1001+라틴) + `font-display:swap` + 400/700/800 preload.
- **정적 우위**: 콘텐츠가 prerender 정적 → LCP 유리. Lighthouse(LCP/INP/CLS) CI.

### 9.4 OG 공유 카드
- **빌드 타임 prerender**: kit별 정적 HTML에 `og:title/description/image`, `twitter:card=summary_large_image`, `og:url` 포함 → 봇이 JS 미실행해도 읽음.
- **OG 이미지**: 빌드 타임에 `@vercel/og`(Satori) 등으로 교과 팔레트+제목 1200×630 생성 → R2/정적 자산. 대표 이미지(`og_image`) 있으면 오버라이드.
- 단축링크는 `id==kitId`(§5.5)라 리라이트만 — OG는 `/k/<id>` prerender가 그대로 제공.

### 9.5 테스트 / 관측 / 백업
- **단위(Vitest)**: 새니타이즈 화이트리스트, 마크다운→HTML 변환, video_id 검증, 필터 로직(`homeVals`), `flowGroups`, field-map, shortId.
- **통합(@cloudflare/vitest-pool-workers)**: view dedupe, like 멱등, 단축링크 리라이트.
- **E2E(Playwright)**: 공유 링크→뷰어, 키보드 내비, 모달 포커스 트랩, OG 메타 존재.
- **파이프라인 테스트**: 잘못된 시트(enum 위반/필수 누락/XSS body)에서 빌드 실패하는지.
- **접근성(axe-core)** CI 회귀 차단.
- **관측**: 프런트 Sentry, Pages/Workers Logpush, Analytics Engine(꾸러미별 열람·체류). 개인정보 비수집.
- **백업**: 콘텐츠는 Git이 곧 백업. KV 카운터는 주기 export(Function/cron) → R2.

---

## 10. 개발 단계 & 마일스톤

### Phase 0 — 부트스트랩 (1주)
- 단독 레포(현 edu-kit) 스캐폴드: RR7+Vite, **edu-link `src/client/index.css` 토큰 복사**(@theme + HeroUI accent override + gemini/glassmorphism) + 단계 색·교과 팔레트 추가, 동일 dep 버전 핀(HeroUI 3 / RR7 7.15 / Tailwind 4 / lucide 1.16), Pretendard, Cloudflare Pages 프로젝트 + 바인딩(KV/R2), CI 골격.
- 완료: Pages Preview에 빈 홈 렌더, CI 그린, 프로토타입 토큰과 색 일치 확인.

### Phase 1 — 읽기 앱 MVP (2~3주)
- 시드 `data/*.json`(SAMPLE_DATA + t8jo/tDangun 변환), 홈 갤러리(필터·카드·빈 상태), 뷰어(목차·4타입 본문), 데이터 모달, 경로 라우팅 + kit별 prerender + OG 메타, 단축링크 리라이트.
- 완료: ab12(활동형)·cd34(흐름형)가 프로토타입과 픽셀에 가깝게 렌더, 필터·URL 딥링크, OG 메타 존재.

### Phase 2 — 콘텐츠 파이프라인 (2주) — *핵심 운영 가치*
- `scripts/sheet-to-json.ts`+`field-map.ts`(ETL·검증·새니타이즈, Pages prebuild), Google Sheet 템플릿(3탭+데이터검증), **GAS "발행" 버튼**(시트→`data/raw/*.json` GitHub 커밋), 마크다운→`.sk-rich` 변환, 라이선스 게이트. (GitHub Actions 미사용)
- 완료: 편집자가 시트 수정→버튼 클릭→Pages 빌드(검증·새니타이즈)→배포로 콘텐츠 갱신. 잘못된 시트는 빌드 실패.

### Phase 3 — 카운트 + 공유 강화 (1~2주)
- view/like Functions + KV(dedupe·멱등·rate limit), 낙관적 UI, 링크 복사, **동적 OG 이미지**(빌드 생성), lite-youtube 파사드, 이미지 R2 미러.
- 완료: 조회수/좋아요 어뷰징 방지 동작, 카카오톡/슬랙 OG 카드 표시, LCP/INP 목표.

### Phase 4 — 품질·운영 강화 (지속)
- 접근성 전수(axe), 성능 예산(Lighthouse CI), Sentry/Analytics/Logpush, KV 백업 cron, E2E·파이프라인 테스트 스위트.
- 완료: KWCAG 점검 통과, 관측·백업·테스트 파이프라인 안정.

> **MVP 경계**: Phase 0~1 = 시연 가능한 읽기 앱(시드 콘텐츠). Phase 2 = 운영 가능(편집팀 자가 발행). Phase 3 = 공유·지표 완성.

---

## 11. 제안 디렉터리 구조 (단독 레포)

```
edu-kit/  (현 eduinside/edu-kit — 단독 레포)
├─ app/                        # React Router 7 (framework mode)
│  ├─ root.tsx                 # 루트 레이아웃, CSP, 폰트
│  ├─ routes/
│  │  ├─ _index.tsx            # / 홈 갤러리
│  │  └─ k.$kitId.($itemId).tsx   # /k/:kitId/:itemId? 뷰어 (prerender + OG)
│  ├─ components/
│  │  ├─ home/                 # Header, FilterCard, UnitChips, KitCard, KitGrid, EmptyState
│  │  ├─ viewer/               # ViewerTopbar, Sidebar, StageGroup, ItemButton, ContentPane
│  │  ├─ content/              # IntroContent, VideoContent(lite-yt), ImageContent, TextContent
│  │  └─ common/               # DataModal
│  ├─ styles/
│  │  └─ tokens.css            # ← edu-link/src/client/index.css 복사 + 단계색·교과팔레트 추가
│  └─ lib/                     # sanitize.client(DOMPurify), youtube(video_id), filters
├─ functions/                  # Cloudflare Pages Functions
│  └─ api/kits/[id]/           # stats.ts, view.ts, like.ts  (+ 단축링크 [[catchall]] 또는 _redirects)
├─ data/
│  ├─ raw/                     # ← GAS "발행" 버튼이 커밋한 시트 원본 스냅샷
│  │  └─ kits.json items.json stage_meta.json
│  └─ (kits/items/stage_meta.json = 빌드 산출, gitignore 가능)
├─ scripts/
│  ├─ sheet-to-json.ts         # ETL prebuild(raw→검증·새니타이즈·정본 JSON)
│  ├─ field-map.ts             # 프로토타입/시트→정본 컬럼 매핑(단일 소스)
│  └─ seed-kv.ts               # 초기 views/likes KV 적재
├─ gas/                        # Google Apps Script 소스(시트 "발행" 버튼 → GitHub 커밋)
│  └─ publish.gs               # ~50줄: 3탭 직렬화 + Contents API PUT
├─ tests/                      # unit / integration(miniflare) / e2e(Playwright+axe)
├─ public/                     # 정적 자산(Pretendard 등)
├─ _prototype/                 # (참고) 디자인 핸드오프 원본
├─ .github/workflows/ci.yml    # (선택) lint/typecheck/test on PR. 발행용 Action 없음 — 발행은 GAS 버튼
├─ docs/IMPLEMENTATION_PLAN.md # 본 문서
├─ wrangler.jsonc              # Pages/Functions 바인딩(KV/R2)
└─ package.json                # HeroUI 3 / RR7 7.15 / Tailwind 4 / lucide 1.16 (edu-link과 동일 버전 핀)
```
> 향후 토큰 단일 출처가 필요하면 `app/styles/tokens.css`를 `@eduinside/design-tokens` 패키지로 추출해 edu-link과 공유(§3.3·§12 D-모노레포). 현 시점엔 복사가 더 단순.

---

## 12. 리스크 & 미결정 사항

### 12.1 리스크 & 완화
| 리스크 | 완화 |
|---|---|
| 프로토타입↔명세 필드명 불일치(dae/ready/html/vTitle…) | DATA_MODEL.md 정본 + `field-map.ts` 단일 매핑(§5.0). stage는 `단원안내`(공백 없음) |
| **시트 셀에 위지윅/긴 본문 관리 한계** | 본문은 **마크다운 in 셀 → 빌드 변환**(§6.4)으로 raw HTML 작성 회피. 항목·본문이 폭증하면 D1+본문 MDX/Git 이전(D-A) |
| 위지윅 body 저장형 XSS | 빌드 새니타이즈 + 클라 DOMPurify 이중 + CSP. a 태그 http(s)·rel=noopener. 시드도 변환 후 정제(§5.7) |
| **발행 지연(발행=빌드 수 분)** | 중앙 편집팀 발행 주기에 무해. 즉시성이 필요해지면 런타임 KV 스냅샷/D1 경로로 보완(D-A) |
| 시트가 진실원본인데 누군가 JSON 직접 수정 → 드리프트 | **JSON은 생성물**(수기 편집 금지, 헤더 주석 명시). 시트가 SoT. 비상 시 직접 수정은 즉시 시트 반영 |
| 카운터 어뷰징(봇·연타) | visitorId+KV TTL dedupe, rate limit, 좋아요 1인1표, adaptive Turnstile, raw 이벤트 분리 |
| KV 최종일관성으로 카운트 누락/부정확 | 저QPS 허용. 정확/고QPS 필요 시 Durable Object 카운터 승격 |
| 해시 라우팅 유지 시 OG 전부 빈/동일 | 경로 라우팅 + kit별 prerender OG 메타 |
| 영상 다수 즉시 임베드로 LCP/INP 악화 | lite-youtube 파사드 + 선택 항목만 iframe + nocookie + lazy |
| 모달·키보드·iframe title·색대비(KWCAG) | HeroUI Modal, button/role+키, aria-*, axe CI |
| 유물 이미지·영상 저작권/핫링크 | image_source/license·video_license + 뷰어 출처 표기 + R2 미러 + 라이선스 미입력 빌드 경고/차단 |

### 12.2 사용자 결정 필요 사항
| # | 항목 | 선택지 | 추천 |
|---|---|---|---|
| **D-모노레포** | 디자인시스템 공유 방식 (✅ 실측 완료) | (a) 단독 레포 + `index.css` 복사 / (b) `@eduinside/design-tokens` 패키지 추출 / (c) edu-link 모노레포 전환 | **(a) 현행** — edu-link은 npm 단일 앱이라 (c)는 과투자. 공유 면 커지면 (b)로 단일 출처화. edu-link 변경 없음 |
| **D-트리거** | 발행 트리거 방식 | (a) **GAS 시트 "발행" 버튼**→GitHub 커밋 / (b) GitHub Action / (c) 개발자 `pnpm sync` | **(a) 확정** — 편집자가 시트를 안 떠남, Actions 복잡성 회피. 변환·검증은 Pages 빌드(TS). PAT은 GAS Script Properties |
| **D-검수** | 발행 시 검수 단계 | (a) main 직접 커밋 + 빌드 게이트(단순) / (b) content 브랜치→Preview→머지 | **(a)** — 중앙 편집팀 신뢰 + 빌드 검증이 안전망. 시각적 사전검수가 필요하면 (b) |
| **D-GAS권한** | GAS 실행 권한 | (a) 편집자 계정으로 실행 / (b) 설치형 트리거(시트 소유자 권한) | GAS가 시트를 직접 읽으므로 서비스계정/CSV 공개 불필요. 버튼 클릭 시 권한 동의 1회 |
| **D-본문문법** | 본문 입력 문법 | (a) 마크다운+콜아웃 디렉티브 / (b) 셀 raw HTML(신뢰) / (c) 별도 미니 에디터(후속) | **(a)** — 시트 친화 + XSS 표면 최소 |
| **D-카운터** | 카운터 저장소 | (a) KV / (b) Durable Object / (c) D1 | **(a) 초기** — 최소 인프라. 정확/고QPS 시 (b) 승격 |
| **D-A(이전)** | 콘텐츠 정적 JSON의 한계 도달 시 | (a) 시트 유지(현행) / (b) D1+본문 MDX/Git 이전 | **(a) 유지**, 항목/본문 폭증·동시편집·즉시성 요구 시 (b)로 단계 이전(§5 DDL이 타깃) |
| **D-도메인** | `kit.dgedu.link` 연결 | Pages 커스텀 도메인 + `/<id>`→`/k/<id>` 리라이트 | Bulk Redirects 또는 `_redirects`/catchall Function. DNS·도메인 소유 확인 필요 |

---

## 13. 부록

### 13.1 샘플 시드 데이터 참조
- `kits` 13행: SAMPLE_DATA.md 그대로(ab12~qb02). `published`는 ab12/cd34만 true.
- `items`: ab12 활동형 8항목(intro 1 + video 3 + image 2 + text 2), cd34 흐름형 7항목(전부 video).
- `stage_meta`(ab12): 생각열기="도구가 달라지면 삶도 달라질까?", 탐구하기="고조선은 어떻게 세워지고 무엇을 남겼을까?", 확장하기="우리 역사의 첫 국가는 어떤 의미가 있을까?". (단원안내=null)
- intro 상세(ab12): coreIdea/coreQuestion/concepts(6)/standardCode `[6사07-01]`/standardText.
- text body 2건(`t8jo`·`tDangun`): `수업꾸러미.dc.html` 변수에서 가져와 마크다운/`.sk-callout` 변환→새니타이즈→JSON(§5.7). 영상 데모 ID `aqz-KE-bpKQ` → 실URL 교체 TODO.

### 13.2 핸드오프 파일 목록
경로: `_prototype/design_handoff_수업꾸러미/`
- `README.md` — 화면/인터랙션/디자인 토큰/에셋(**디자인 정본**).
- `DATA_MODEL.md` — kits/items 스키마, 두 흐름, 구동 흐름, 마이그레이션(**필드명 정본**).
- `SAMPLE_DATA.md` — 시드 데이터(개발용).
- `수업꾸러미.dc.html` — 마크업·로직·실데이터 단일 레퍼런스(KITS/CONTENT/STAGE/SUBJ, 필터/카운트 로직, t8jo/tDangun 본문).
- `support.js` — 프로토타입 런타임(사내 포맷, 그대로 사용 금지).
