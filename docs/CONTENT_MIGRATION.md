# 기존 자료 → 수업꾸러미 컨버팅 전략

모든 변환의 종착점은 **시트 3탭(kits / items / stage_meta) = `data/raw/*.json`** 이다.
ETL(`scripts/sheet-to-json.ts`)이 검증·새니타이즈하므로, "기존 자료를 **시트 행**으로 만들기"가 핵심이다.
잘못 변환되면 Pages 빌드가 실패해 배포되지 않는다(안전망).

## 1. 공통 4단계

1. **인벤토리 & 매핑** — 기존 자료를 목록화하고, 각 자료를 *(학년·학기·교과·대단원·꾸러미·흐름)* 에 매핑한다.
   - 단위 결정: **1 꾸러미 = 1 단원(또는 한 주제 묶음)**. 흐름은 활동형(단원안내→생각열기→탐구하기→확장하기) 또는 핵심용어 흐름형(도입→전개→정리).
2. **항목 분해** — 한 꾸러미를 `stage × type(intro/video/image/text)` 항목들로 쪼갠다.
3. **시트 채우기** — 소스 타입별 변환(아래). 소량은 수기, 대량은 스크립트/LLM 보조.
4. **점진 발행** — 핵심부터 `published=TRUE`로 발행 → 빌드 검증 통과 확인. 나머지는 골격만(준비 중=FALSE).

## 2. 소스 타입별 변환

| 기존 자료 | → item type | 변환 방법 | 주의 |
|---|---|---|---|
| YouTube 영상 / 재생목록 | `video` | `video_url` + `start_sec`/`end_sec` + `video_title`/`video_desc` | **가장 쉬움**. 재생목록은 일괄 추출 |
| 슬라이드·PPT·한글·Word(설명글) | `text` | 핵심 텍스트 → 제한 마크다운(`###`/`**`/표/`:::warn`). 이미지 많으면 `image`로 분리 | 인라인 HTML 금지(마크다운만) |
| 유물·사진 이미지 | `image` | R2 업로드(또는 외부 URL) → `image_url` + `image_source`/`image_license` | R2 업로드 도구는 후속. 미지정 시 placeholder |
| 단원 개요·성취기준 | `intro` | `core_idea`/`core_question`/`concepts`(`;`)/`standard_code`/`standard_text` | 단원안내 stage 첫 항목 |
| 기존 구조적 데이터(시트/DB/JSON/웹) | 다양 | **매핑 스크립트**로 `data/raw/*.json` 직접 생성 | 컬럼 정규화는 `scripts/field-map.ts` 재사용 |

## 3. 자동화 — 소스가 **구조적**일 때 (시트/CSV/DB/JSON)
- `scripts/`에 소스별 변환기 추가: 예 `scripts/import-<source>.ts` → 읽기 → 컬럼/구조 매핑 → `data/raw/*.json` 출력 → 기존 ETL 통과.
- 한 번 만들면 반복 변환·갱신이 자동. 흐름형 매핑·concepts 분할 등은 ETL이 이미 처리.

## 4. 반자동 — 소스가 **비구조적**일 때 (문서·슬라이드)
- 문서/슬라이드 텍스트를 LLM에 주고 *"이 단원을 수업꾸러미 items 행(stage·type·title·description·video/intro/text 필드)으로 추출"* 프롬프트 → 초안 → **편집자 검수** → 시트.
- 대량이면 배치: 문서 텍스트 추출(docx/pptx/pdf 파서) → LLM 변환 → JSON → 검수.
- 추출 프롬프트 템플릿은 소스 확정 후 `docs/`에 추가.

## 5. 품질·검증
- ETL이 enum/필수/형식·**XSS 새니타이즈** 검증 → 잘못된 변환은 빌드 실패로 차단.
- 영상 데모 ID `aqz-KE-bpKQ`는 **실제 URL로 교체 필수**. 이미지·영상 **출처/라이선스** 채우기.
- 소량 배치로 발행하며 뷰어 확인(`/<id>`).

## 6. 권장 순서
1. **핵심 단원 1~2개를 손으로 완성**(패턴 확립, 시드 ab12/cd34 참고).
2. 같은 단원군을 **스크립트/LLM로 확장**.
3. **점진 공개**(published 토글).

---

## ✅ 확정 경로 — 구조적 데이터 + YouTube (자동 변환 스크립트)
기존 자료가 **기존 시트/DB/웹 + YouTube 재생목록**이므로 LLM 추출이 아니라 **스크립트 자동 변환**으로 간다. 두 개의 변환기를 둔다.

### A. 기존 시트/DB/웹 → `data/raw/*.json` 매퍼 (`scripts/import-source.ts`)
- 입력: 기존 구조의 행(시트 export CSV/JSON, DB 쿼리 결과, 또는 웹 스크랩 JSON).
- 처리: 소스 컬럼 → 정본 필드 매핑(`field-map.ts` 재사용) → kits/items/stage_meta 행 생성.
- **필요(알려주실 것)**: 소스의 실제 스키마/샘플 — ① 어디에 있나(어느 시트/DB/URL), ② 한 행이 무엇을 뜻하나(꾸러미? 항목?), ③ 학년·학기·교과·단원·stage·type을 어떤 컬럼에서 끌어오나. 샘플 10~20행만 주시면 매퍼를 바로 작성·검증.

### B. YouTube 재생목록 → items(video) 생성기 (`scripts/import-youtube.ts`)
- 입력: `재생목록 ID ↔ 꾸러미(kitId)` 매핑 + (각 영상의 stage 지정).
- 처리: YouTube Data API로 영상 제목·설명·길이 fetch → `video` 항목 행(`video_url`/`video_title`/`video_desc`) 초안 생성. 흐름형이면 `title`=핵심용어(편집자 지정), `video_title`=영상제목.
- **필요**: ① YouTube Data API 키(`YOUTUBE_API_KEY`) 또는 재생목록 export, ② 재생목록↔꾸러미 매핑, ③ 영상별 stage(자동은 순서대로, 미세조정은 편집자).
- 자동 80%(메타 fetch) + 편집자 20%(stage·핵심용어 지정).

### 공통 마무리
- 생성된 `data/raw/*.json`은 기존 ETL이 검증·새니타이즈 → 빌드 통과해야 배포.
- 처음엔 한 단원으로 파일럿 → 검증 후 일괄.

> **다음**: (A) 기존 구조의 **샘플 몇 행**, (B) **YouTube API 키 + 재생목록↔꾸러미 매핑**을 주시면 두 스크립트를 실제로 만들어 검증해 드립니다.
