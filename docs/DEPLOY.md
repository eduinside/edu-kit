# 배포 가이드 — Cloudflare Pages + 공유 D1(edu-link-db)

> 콘텐츠는 정적(빌드 산출), 조회수·좋아요만 런타임(Pages Functions + D1). KV 미사용.
> 아래는 Cloudflare 계정 작업이라 직접 수행이 필요하다.

## 1. D1 스키마/시드 적용 (1회)
공유 DB `edu-link-db`에 `edukit_*` 테이블을 멱등 생성한다(edu-link 기존 테이블과 분리).
```bash
npm run seed:stats                                              # db/seed-stats.sql 생성
wrangler d1 execute edu-link-db --remote --file db/schema.sql   # edukit_stats/likes/view_dedupe
wrangler d1 execute edu-link-db --remote --file db/seed-stats.sql  # 초기 카운트(최초 1회)
```
> `CREATE TABLE IF NOT EXISTS`라 edu-link의 `wrangler d1 migrations` 트래킹을 건드리지 않는다.

## 2. R2 버킷
```bash
wrangler r2 bucket create edu-kit-media        # 이미지/OG 미디어
```

## 3. Pages 프로젝트
- GitHub 레포(`eduinside/edu-kit`) 연결, 또는 `wrangler pages deploy dist`.
- 빌드 명령 `npm run build`(= prebuild `npm run data` → `vite build`), 출력 `dist`. `content/kits/*.yaml` 형식 오류가 있으면 빌드가 실패한다(배포 차단).
- **바인딩**(Settings > Functions): D1 `DB` → `edu-link-db`, R2 `MEDIA` → `edu-kit-media`.
- **Preview 환경**: 프로덕션 `edu-link-db` 카운트 오염 방지를 위해 **별도 dev D1**(예: `edu-kit-db-dev`)을 Preview 바인딩으로. (dev D1에도 `db/schema.sql` 적용.)

## 4. 도메인
- `kit.dgedu.link`를 Pages 커스텀 도메인으로 연결.
- 앱 경로가 `/<id>`라 단축 도메인과 동일 경로 → **리라이트 불필요**. 딥링크는 `public/_redirects`(`/* → index.html`)로 SPA 폴백.

## 5. 콘텐츠 발행
- 콘텐츠 정본은 `content/kits/*.yaml`. 절차는 [OPERATIONS.md](OPERATIONS.md) §3-5 — 작업 브랜치 push → Pages **미리보기 배포**에서 확인 → `main` 병합 → 운영 배포.
- 미리보기 배포는 Preview 환경 바인딩을 쓴다. 위 3절의 dev D1을 Preview에 묶어 두지 않으면 미리보기 조회가 운영 카운터에 섞인다.
- 구글 시트 + GAS 발행(옛 `gas/publish.gs`·`video-check.gs`)은 2026-10-02 은퇴. 시트의 Apps Script 발행 버튼과 스크립트 속성 `GITHUB_TOKEN`은 지우고, GitHub에서 그 PAT를 폐기한다. 영상 점검은 `npm run videos`(로컬 환경 변수 `YT_API_KEY`).

## 6. 로컬 검증(참고)
```bash
npm run build
wrangler d1 execute edu-link-db --local --file db/schema.sql
wrangler d1 execute edu-link-db --local --file db/seed-stats.sql
wrangler pages dev dist                         # http://localhost:8788
# GET /api/kits/ab12/stats, POST /api/kits/ab12/{view,like}
```
> 로컬 wrangler 바이너리가 `compatibility_date`를 지원하지 않으면 `wrangler.jsonc`의 날짜를 낮추거나 wrangler를 업그레이드한다(현재 `2026-05-03`).

## 남은 작업 (Phase 3 후속)
- kit별 prerender + 동적 OG 이미지(`@vercel/og` 등 빌드 생성) — 현재는 정적 OG 메타.
- 홈 카드 라이브 카운트(배치 stats 엔드포인트로 hydrate) — 현재 카드는 시드 표시.
- 본문 클라 DOMPurify 이중 방어(dompurify 추가), 이미지 R2 업로드 도구.
