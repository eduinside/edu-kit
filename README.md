# edu-kit (수업꾸러미)

대구광역시교육청 교사가 *학년·학기·교과·단원*으로 수업 콘텐츠 묶음("꾸러미")을 찾아
한 화면에서 영상·이미지·읽기자료·활동을 순서대로 보는 웹 서비스.
짧은 링크 `kit.dgedu.link/<id>`로 공유, 조회수·좋아요로 활용도 추적.

**라이브**: https://kit.dgedu.link · 현재 81 꾸러미(공개 59) · 에듀나비 연계 콘텐츠.

- 편집팀 저작 가이드: [docs/SHEET_TEMPLATE.md](docs/SHEET_TEMPLATE.md) · 시트 세팅: [docs/SHEET_SETUP.md](docs/SHEET_SETUP.md)
- 배포: [docs/DEPLOY.md](docs/DEPLOY.md) · 용어 설명·OX 퀴즈 설계: [docs/FEATURE_PLAN_terms-quiz.md](docs/FEATURE_PLAN_terms-quiz.md) · 최초 설계(역사): [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## 아키텍처

```
Google Sheet ──[발행 버튼/GAS]──▶ GitHub(data/raw/*.json) ──push──▶ Cloudflare Pages (Git 연동, 자동 빌드)
                                                                       │ prebuild: scripts/sheet-to-json.ts
                                                                       │  (zod 검증·마크다운→HTML·새니타이즈·콘텐츠 수 집계)
                                                                       ▼ 정적 SPA 배포 + 꾸러미별 OG 메타(_middleware)
조회수·좋아요만 런타임: Pages Functions + D1(공유 edu-link-db, edukit_* 테이블)
```

- **콘텐츠 = 정적 JSON**(빌드 산출). 런타임 콘텐츠 DB·어드민 UI 없음. 편집은 구글 시트에서, "발행" 버튼이 GitHub에 커밋 → Pages 자동 빌드/배포.
- **카운터만 런타임**: 공유 D1 `edu-link-db`(`edukit_stats`/`edukit_likes`/`edukit_view_dedupe`).
- **꾸러미 두 유형**: `activity`(활동형: 단원안내·생각열기·탐구하기·확장하기) / `flow`(핵심 용어 흐름형: stage가 핵심 용어 자체). 현재 콘텐츠는 전부 흐름형.

## 개발

```bash
npm install
npm run sync        # data/raw/*.json → 검증·변환·새니타이즈 → data/*.json (prebuild에서 자동)
npm run dev         # vite 개발 서버 (predev=sync)
npm run build       # prebuild=sync → vite build → dist/
npm run typecheck
```

### 구조
- `app/routes/{HomePage,ViewerPage}.tsx` — 홈 갤러리 / 뷰어. ViewerPage는 `React.lazy`로 분리(무거운 items.json 지연 로드).
- `app/components/*` — KitCard, SearchModal, UsageGuide, Modal, SegmentedControl, ResourceLinks(외부 학습자원 링크), viewer/{Sidebar,ContentPane,QuizPane}.
- `app/lib/` — `data.ts`(kits, 가벼움) · `kit-content.ts`(items/stage_meta, 무거움 → 뷰어·검색만 동적 로드) · `quiz.ts`(개념 확인 OX, 뷰어 청크) · `design.ts`(단원색·단계색·교과아이콘) · `search.ts`(통합 검색) · `api.ts`(카운터) · `stats.ts`(시드).
- `app/styles/tokens.css` — 디자인 토큰(edu-link index.css 계승) + 컴포넌트 스타일.
- `scripts/` — `sheet-to-json.ts`(ETL) + `field-map`·`markdown`·`sanitize`·`shortid`·`types`. `gen-og.py`(OG 카드) · `gen-sheet-xlsx.py`(시트 템플릿) · `seed-stats.ts`(D1 시드 SQL).
- `functions/` — `_middleware.ts`(꾸러미별 OG 메타 주입) · `api/kits/[id]/{stats,view,like}.ts` + `_shared.ts`(D1 카운터).

### 주요 기능
- **홈**: 학년·학기·교과·단원 필터(URL 쿼리 딥링크). 기본값=접속 월 기준 학기 + 자료 있는 학년 랜덤, 최근 선택 localStorage 복원. 카드 썸네일은 단원(unit_no)별 색. 통합 검색(단원/영상/성취기준 그룹).
- **뷰어**: 핵심어 그룹 목차 사이드바 + 본문(intro 문서형 / 영상 영화관 모드 + lite-youtube 파사드 / 이미지 / 위지윅). 조회수·좋아요·링크복사. 없는 id는 랜딩으로 리다이렉트.
  - **핵심 용어 설명**: intro의 용어 칩 탭 → 바로 아래 설명 패널 토글(한 번에 하나). 시트 `concept_desc`(`;` 구분) → 빌드가 `concepts`와 짝지어 `concept_defs` 산출. 설명 없는 용어는 비탭.
  - **개념 확인 OX 퀴즈**: 단원 마지막 가상 화면(`/:kitId/_quiz`). 풀에서 2문제 무작위(진입·다시풀기마다 다른 조합), O/X 채점·해설. 풀 2개 미만이면 화면 미노출. 데이터는 시트 `quiz` 탭 → `data/quiz.json`.
  - **외부 학습자원 링크**(`ResourceLinks`): 에듀맵스·개념튼튼 ON싹(새 창). 홈 푸터 + 퀴즈 완료 화면 하단.
- **공유 미리보기(OG)**: 꾸러미별 카드 `public/og/<id>.png`. ⚠️ **콘텐츠(꾸러미 추가/제목 변경) 후 `npm run og` 재실행 + 커밋 필요** — Cloudflare 빌드는 폰트가 없어 생성 못 함.

## 콘텐츠 편집(편집팀)
구글 시트의 `kits`/`items`/`stage_meta`(필수) + `quiz`(선택, 개념 확인 OX) 탭을 채우고 **발행** 버튼(gas/publish.gs) → 자동 배포.
`quiz` 탭은 없어도 발행·빌드가 안 깨짐(점진 도입). 용어 설명은 `items` intro 행의 `concept_desc` 열.
컬럼·입력 규칙은 [docs/SHEET_TEMPLATE.md](docs/SHEET_TEMPLATE.md) 참조. shortId는 빈 id 칸에 발행 시 자동 부여.

## 배포
Cloudflare Pages(Git 연동, `main` push → 자동 빌드). `wrangler.jsonc`에 D1=`edu-link-db`. 커스텀 도메인 `kit.dgedu.link`. 자세한 절차·D1 시드는 [docs/DEPLOY.md](docs/DEPLOY.md).
