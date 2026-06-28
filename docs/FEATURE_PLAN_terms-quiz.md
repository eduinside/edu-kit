# 신규 기능 구현 계획서 — 핵심 용어 설명 + 개념 확인 OX 퀴즈

> ✅ **구현·배포 완료(2026-06-28).** 본 계획대로 M1(UI+스키마+빌드) 출하 후 전 단원 콘텐츠 발행. 현재 동작은 [README.md](../README.md) "주요 기능" 참조. 아래는 설계 기록.

작성일: 2026-06-28 · 대상: edu-kit 뷰어
관련 코드: [`ContentPane.tsx`](../app/components/viewer/ContentPane.tsx) · [`ViewerPage.tsx`](../app/routes/ViewerPage.tsx) · [`kit-content.ts`](../app/lib/kit-content.ts) · [`sheet-to-json.ts`](../scripts/sheet-to-json.ts) · [`types.ts`](../scripts/types.ts)

---

## 0. 확정 결정 (검토 시 합의)

| # | 항목 | 결정 |
|---|---|---|
| D1 | 콘텐츠(용어 설명·OX 문제) 출처 | **AI 자동 생성 후 편집팀 검수** — 오프라인 초안 생성 → 검수 → 시트 입력. 생성은 빌드와 분리 |
| D2 | OX 퀴즈 단원당 문제 풀 | **5~8개** (2개 랜덤 추출 → 매번 다른 조합) |
| D3 | 핵심 용어 칩 탭 동작 | **칩 아래 설명 패널 토글**(한 번에 하나, 다른 텍스트 간섭 없음) |
| D4 | 진행 방식 | **본 계획 문서 우선** → 이후 UI 골격(데이터 없으면 자동 숨김)부터 구현 |

### 설계 원칙 (두 기능 공통)
- **UI는 쉽고, 콘텐츠가 임계 경로다.** 화면 코드는 작은 변경, 진짜 비용은 ~600개 정의 + ~400~650개 OX 문제 저작.
- **점진 배포(graceful degradation).** 데이터가 없는 단원/용어는 자동으로 숨김 → UI를 먼저 배포하고 검수된 콘텐츠를 단원별로 채워 나간다. 빌드는 결손에 경고만 남기고 계속 진행(기존 `warn()` 관례).
- **기존 패턴 재사용.** 시트 ` ; ` 순서 짝짓기([`parseStandards`](../scripts/sheet-to-json.ts#L97)), `warn`+건너뜀 복원력, 뷰어 청크 코드분할([`kit-content.ts`](../app/lib/kit-content.ts)) 을 그대로 따른다.

---

## 1. 기능 1 — 핵심 용어 탭 → 설명 패널

### 1.1 현황
- intro 항목의 `concepts: string[]`(용어 이름만, 단원당 7~9개)이 [`ContentPane.tsx:59`](../app/components/viewer/ContentPane.tsx#L59) "단원 핵심 용어" 섹션에 **정적 pill**로 렌더된다.
- **설명 텍스트 데이터가 전혀 없다** → 이게 핵심 작업.

### 1.2 데이터 모델
시트 `items` 탭 intro 행에 **`concept_desc` 컬럼** 추가. 기존 성취기준과 **동일한 ` ; ` 순서 짝짓기**: `concepts`의 i번째 용어와 `concept_desc`의 i번째 정의가 짝.

```
concepts     = 무게 ; 수평 잡기 ; 저울
concept_desc = 물체의 무거운 정도. ; 양쪽이 균형을 이뤄 기울지 않는 상태. ; 무게를 재는 도구.
```

빌드 산출(`types.ts` Item에 추가):
```ts
concept_desc?: string;                              // 시트 원본(';' 구분)
concept_defs?: { term: string; def: string }[];     // 빌드 산출: concepts와 index로 짝
```
> `concepts` 배열 형태는 **유지**(검색·다른 표시 영향 없음). 정의는 별도 산출 필드로 더해 짝만 만든다.

### 1.3 빌드 ([`sheet-to-json.ts`](../scripts/sheet-to-json.ts))
- `ItemSchema`에 `concept_desc: z.string().optional()` 추가.
- `parseStandards` 옆에 `parseConceptDefs(concepts: string[], desc: string)` 추가 — `desc`를 `;`로 분리해 `concepts`와 index로 zip, 정의가 빈 항목은 제외 → `concept_defs`. 짝이 안 맞으면 있는 쪽만(성취기준과 동일).
- intro 산출 시 `concept_defs.length`면 부착([`L207`](../scripts/sheet-to-json.ts#L207) 패턴).

### 1.4 UI ([`ContentPane.tsx`](../app/components/viewer/ContentPane.tsx) Intro 핵심 용어 섹션)
- `concept_defs`로 `term → def` Map 구성.
- 정의가 있는 용어 칩은 `<button>`(나머지는 현행 `<span>` 그대로). `useState<string|null>(openTerm)` — **한 번에 하나만** 토글.
- **설명 패널은 칩 묶음(flex-wrap) 바로 아래, 전체 폭으로** 펼쳐진다. "핵심 용어"가 Intro 카드의 **맨 아래 섹션**이므로 패널이 열려도 위쪽 텍스트(목적·질문·성취기준)는 밀리지 않는다 → 요구("다른 텍스트 간섭 없이") 충족.
- 접근성: 활성 칩 `aria-expanded`, 패널 `role="region"` + `aria-live="polite"`, `Esc` 닫기. 모바일 터치 우선(hover 툴팁 금지). 높이/투명도 트랜지션.
- **점진 배포**: 정의 없는 칩 = 현행 정적 모양(클릭 불가). 검수된 정의가 들어오면 자동으로 탭 가능.

---

## 2. 기능 2 — 개념 확인 OX 퀴즈 (단원 마지막 화면)

### 2.1 현황
- 뷰어는 [`getGroups`→`flatItems`](../app/lib/kit-content.ts)로 항목을 선형 나열(prev/next). `flat`의 끝 = 단원 마지막 화면.
- 퀴즈 데이터·렌더 모두 없음.

### 2.2 데이터 모델 — 신규 시트 탭 `quiz` + `data/quiz.json`
items에 끼워 넣지 않고 **별도 탭/파일**로 둔다(뷰어 "항목"이 아니고 형상이 달라 오버로드보다 깔끔).

```ts
// types.ts
export interface QuizItem {
  kit_id: string;
  statement: string;          // O/X 판단 문장 (쉬운 난이도)
  answer: "O" | "X";          // 정답
  explain?: string;           // 한 줄 해설
  sort_order?: number;
}
```
시트 `quiz` 탭 컬럼: `kit_id` · `statement` · `answer`(O/X) · `explain` · `sort_order`. **단원당 5~8행**(D2).

### 2.3 발행·빌드
- **GAS** [`gas/publish.gs`](../gas/publish.gs#L22) `CONFIG.tabs`에 `'quiz'` 추가 → `data/raw/quiz.json` 커밋.
- **빌드** `buildQuiz(kits)` 추가: `kit_id` 존재·`answer ∈ {O,X}`·`statement` 비지 않음 검증, 불량 행은 `warn`+건너뜀 → `data/quiz.json` 출력.
- 발행 published 단원이 **유효 문제 < 2개**면 퀴즈 미노출 → `warn`으로 가시화(편집팀이 미완성 단원 인지).

### 2.4 UI
- **`app/lib/quiz.ts`**(뷰어 청크, lazy): `getQuiz(kitId)`, `pickTwo(pool)`(랜덤 2개 추출). `quiz.json` import는 이 모듈에만 둬 홈 번들에 안 섞이게([`kit-content.ts`](../app/lib/kit-content.ts) 분리 관례).
- **뷰어 통합**: 풀 ≥ 2일 때 `flat` 끝에 가상 "개념 확인" 화면 1개를 추가. 목차([`Sidebar`](../app/components/viewer/Sidebar.tsx))에도 마지막 단계로 노출, prev/next로 자연 연결. 영상이 [`ViewerPage`](../app/routes/ViewerPage.tsx#L170)에서 특수 렌더되듯, 가상 키(`_quiz`)를 감지해 `<QuizPane kitId/>`를 렌더(스키마 `ItemType` 오염 없이).
- **`QuizPane`**: mount 시 `Math.random`으로 풀에서 2개 추출(useState 초기화). 각 문항 = 문장 + **O / X 버튼**. 응답 시 정/오답 표시 + `explain` 한 줄. 둘 다 풀면 점수 + **"다시 풀기"**(새 2문제 re-roll). → "접속할 때마다 다른 문제"(D2 풀 5~8개로 체감).
- **점진 배포**: 풀 < 2면 화면 자체 생략(현행 단원 흐름 그대로).

> 런타임 `Math.random`은 앱 코드라 제약 없음(워크플로 스크립트 한정 제약과 무관).

---

## 3. AI 자동 생성 후 검수 워크플로 (D1)

생성은 **오프라인 1회성 보조**이고 **Pages 빌드와 분리**한다(정확성·결정성·빌드에 API 키 불필요).

```
기존 단원 컨텍스트(core_idea·concepts·standards·영상 제목/설명)
   → AI 초안 생성 (concept_desc + quiz 5~8문항/단원)
   → 편집팀 검수 (정답·진술 정확성, 초등 눈높이)
   → 시트 입력 → 정규 파이프라인(발행 버튼 → 빌드 검증)
```
- 초안은 **시트에 그대로 붙여넣을 수 있는 형식**(xlsx/CSV 행)으로 전달. 빌드 파이프라인은 콘텐츠 출처를 모름(시트만 신뢰).
- **검수 필수 사유**: 초등 교과 정확성. 특히 OX **정답 오류**·애매한 진술·정의의 과한 단순화 위험. 검수 체크리스트(정답 명확성 / 교육과정 부합 / 한 문장 길이)를 함께 운영.
- 파일럿: 1~2개 단원 먼저 생성·검수해 품질·형식 확정 후 전 단원 확대.

---

## 4. 변경 파일 요약

| 영역 | 파일 | 변경 |
|---|---|---|
| 타입 | [`scripts/types.ts`](../scripts/types.ts) | Item에 `concept_desc`·`concept_defs`; 신규 `QuizItem`; `ContentBundle`에 quiz |
| 빌드 | [`scripts/sheet-to-json.ts`](../scripts/sheet-to-json.ts) | `ItemSchema.concept_desc`; `parseConceptDefs`; `buildQuiz`; `quiz.json` 출력 |
| 발행 | [`gas/publish.gs`](../gas/publish.gs#L22) | `CONFIG.tabs`에 `'quiz'` |
| 문서 | [`docs/SHEET_TEMPLATE.md`](./SHEET_TEMPLATE.md) | intro `concept_desc` 컬럼 + 탭 4 `quiz` |
| UI-용어 | [`app/components/viewer/ContentPane.tsx`](../app/components/viewer/ContentPane.tsx) | 핵심 용어 칩 토글 + 설명 패널 |
| UI-퀴즈 | `app/lib/quiz.ts`(신규) · [`ViewerPage.tsx`](../app/routes/ViewerPage.tsx) · [`kit-content.ts`](../app/lib/kit-content.ts) · `QuizPane`(신규) | 가상 "개념 확인" 화면 + OX 컴포넌트 |
| 데이터 | `data/raw/quiz.json` · `data/quiz.json`(신규, 빌드 산출) | — |

---

## 5. 마일스톤

1. **M1 — UI 골격 + 스키마/빌드** (콘텐츠 무관, 배포 안전): 타입·빌드·발행 탭, 칩 토글 UI, QuizPane + 가상 화면. 데이터 없으면 전부 자동 숨김 → 즉시 배포 가능.
2. **M2 — 파일럿 콘텐츠**: 1~2단원 AI 초안 → 검수 → 시트 입력 → 실제 동작 검증, 형식·품질 확정.
3. **M3 — 전 단원 확대**: 나머지 단원 생성·검수·입력. 미완 단원은 자동 숨김이라 부분 공개에도 안전.

## 6. 리스크 / 미결

- **정확성(AI 생성)** — 검수 없이는 OX 정답·정의 오류 가능. M2에서 체크리스트 확정. (가장 큰 리스크)
- **퀴즈 풀 < 2** — 미노출 + 빌드 경고로 가시화.
- **정의 길이** — 칩 패널 레이아웃 보호 위해 1~2문장 제한(시트 입력 가이드에 명시).
- **목차 표기** — "개념 확인"을 단계처럼 보일지 별도 스타일로 구분할지 M1에서 디자인 확정.
