# edu-kit (수업꾸러미)

학년·학기·교과·단원으로 수업 콘텐츠 묶음을 보는 서비스. 정본: **kit.dgedu.link**.
콘텐츠 정본 = **`content/kits/<id>.yaml`**(꾸러미 하나 = 파일 하나) → 빌드가 `data/*.json` 생성 → CF Pages(main push 자동 배포). 런타임은 조회수·좋아요 카운터만(D1 공유 `edu-link-db`의 `edukit_*` 테이블).
2026-10-02 구글 시트·GAS 발행에서 전환 — Claude가 파일을 고치고 검증·발행한다.

## 명령
- `npm run check` — 발행 전 점검(오류 0이어야 발행). 꾸러미 지정: `npm run check -- so5121`
- `npm run report` — 변경 보고서(작업본 ↔ origin/main) — 발행 전 운영자에게 보인다
- `npm run videos` — 영상 점검(`.env`의 `YT_API_KEY` 있으면 Data API, 없으면 oEmbed) → YAML의 `channel`·`status`
- `npm run changes -- <기준> <이름> [사유.json]` — 변경 문서(`docs/changes/<이름>.md`·`.csv`) — 여러 꾸러미를 고친 배포에 함께 넣는다
- `npm run data` — YAML → `data/*.json`(predev·prebuild가 자동)
- `npm run og` — 공유 카드(새 꾸러미·제목 변경 때만, 같은 커밋에)
- `npm run dev` / `npm run build` / `npm run typecheck`

## 핵심 문서
- `docs/OPERATIONS.md` — **운영 절차·꾸러미 파일 형식·점검 항목**(작업 전에 읽을 것)
- `docs/IMPROVEMENT_PLAN_claude-ops.md` — 전환 배경·운영자 결정·남은 개선(S1~S9)
- `docs/DEPLOY.md` — 배포 인프라
- `docs/archive/` — 은퇴한 시트 시절 문서

## 규칙
- 콘텐츠는 `content/kits/*.yaml`에서만 고친다. `data/*.json`은 빌드 산출물(직접 수정 금지).
- 발행: 작업 브랜치 → `npm run check`(오류 0) → `npm run report`를 운영자에게 → push → Pages 미리보기에서 운영자 확인 → main 병합.
- `id`·영상 `key`는 바꾸지 않는다(공유 링크·D1 카운터 키). 목록 순서 = 화면 순서(`sort_order` 숫자는 빌드가 매김).
- `channel`·`status`는 `npm run videos`가 채우는 칸 — 손으로 쓰지 않는다.
- 스키마를 바꾸면 `scripts/content.ts`(YAML 스키마)·`scripts/transform.ts`(사이트 데이터)·`docs/OPERATIONS.md` §2를 함께 고친다.
- 꾸러미 유형: `activity`(활동형: 생각열기·탐구하기·확장하기 + 탐구 질문) / `flow`(핵심 용어 흐름형).
