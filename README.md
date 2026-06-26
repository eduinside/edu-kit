# edu-kit (수업꾸러미)

대구광역시교육청 교사가 *학년·학기·교과·단원*으로 수업 콘텐츠 묶음("꾸러미")을 찾아
한 화면에서 영상·이미지·읽기자료·활동을 순서대로 보는 웹 서비스.
짧은 링크 `kit.dgedu.link/<id>`로 공유, 조회수·좋아요로 활용도 추적.

- 전체 설계: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- 편집팀 저작 가이드: [docs/SHEET_TEMPLATE.md](docs/SHEET_TEMPLATE.md)
- 디자인 핸드오프 원본: `_prototype/design_handoff_수업꾸러미/`

## 아키텍처 (요약)

```
Google Sheet ──[발행 버튼/GAS]──▶ GitHub(data/raw/*.json) ──push──▶ Cloudflare Pages 빌드
                                                                       │ prebuild: sheet-to-json
                                                                       │  (검증·마크다운→HTML·새니타이즈)
                                                                       ▼ 정적 배포 + kit별 prerender/OG
조회수·좋아요만 런타임: Pages Functions + D1(공유 edu-link-db, edukit_* 테이블)
```

- 콘텐츠 = 정적 JSON(빌드 산출). 런타임 콘텐츠 DB·어드민 UI·KV 없음.
- 카운터 = 공유 D1 `edu-link-db`(`edukit_stats`/`edukit_likes`/`edukit_view_dedupe`).
- 디자인 토큰은 edu-link `index.css`를 복사 재사용(`app/styles/tokens.css`).

## 콘텐츠 파이프라인 (구현 완료 · 검증됨)

```bash
npm install
npm run sync         # data/raw/*.json → 검증·변환·새니타이즈 → data/*.json
npm run seed:stats   # SAMPLE_DATA 카운트 → db/seed-stats.sql
npm run typecheck
```

- `scripts/sheet-to-json.ts` — ETL(prebuild). zod 검증, 흐름형 매핑, 마크다운→`.sk-rich` HTML, 새니타이즈 게이트.
- `scripts/field-map.ts` · `markdown.ts` · `sanitize.ts` · `types.ts`
- `gas/publish.gs` — 시트 "발행" 버튼(3탭 → GitHub 커밋)
- `db/schema.sql` — `edukit_*` 카운터 테이블(IF NOT EXISTS, edu-link-db 공유)
- `data/raw/*.json` — 시드(ab12 활동형, cd34 흐름형)

## 다음 단계 (Phase 1 — 읽기 앱 UI)

React Router 7 + Tailwind 4 + HeroUI로 홈 갤러리·뷰어·데이터 모달 구현,
경로 라우팅 + kit별 prerender/OG, 단축링크 리라이트, 카운터 Functions.
(앱 의존성은 `package.json` 주석 참고 — 이번 단계에서 추가)

## 배포

Cloudflare Pages(Git 연동). `wrangler.jsonc`에 D1=`edu-link-db`, R2 바인딩.
Preview는 프로덕션 카운트 오염 방지를 위해 별도 dev D1 사용.
