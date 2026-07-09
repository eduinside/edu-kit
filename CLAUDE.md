# edu-kit (수업꾸러미)

학년·학기·교과·단원으로 수업 콘텐츠 묶음을 보는 서비스. 정본: **kit.dgedu.link**.
구글 시트 →(GAS 발행 버튼)→ GitHub `data/raw/*.json` → CF Pages 자동 빌드. 콘텐츠는 정적 JSON, 런타임은 조회수·좋아요 카운터만(D1 공유 `edu-link-db`의 `edukit_*` 테이블).

## 명령
- `npm run dev` — predev로 `sheet-to-json` sync 후 Vite
- `npm run build` / `npm run typecheck`

## 핵심 문서
- `docs/SHEET_TEMPLATE.md` / `docs/SHEET_SETUP.md` — 시트 저작·세팅
- `docs/DEPLOY.md` — 배포

## 규칙
- 콘텐츠 수정은 코드가 아니라 구글 시트에서 — 로컬 JSON 직접 수정 금지 (빌드 시 덮임).
- `sheet-to-json.ts`는 zod 검증·새니타이즈를 담당 — 스키마 변경 시 시트 템플릿 문서 동기화.
- 꾸러미 유형: `activity`(활동형) / `flow`(용어 흐름형, 현재 전부).
