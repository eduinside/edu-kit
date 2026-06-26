# 데이터 모델 — 수업꾸러미

수업꾸러미의 데이터는 **두 개의 테이블(시트)** 로 구성됩니다: `kits`(꾸러미 메타) 1행 = 1꾸러미, `items`(콘텐츠 항목) N행 = 1꾸러미의 본문 항목들. 초기에는 Google Sheets로 시작하고, 항목 수가 임계치를 넘으면 Cloudflare D1로 이전하는 경로를 권장합니다(에듀링크 본 서비스와 동일 스택).

---

## 시트 1 — `kits` (수업꾸러미)

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` (shortId) | string | ✓ | 짧은 링크 키. `kit.dgedu.link/<id>` 라우팅 기준. 4자 영숫자 권장(예: `ab12`). 고유. |
| `title` | string | ✓ | 단원(꾸러미) 제목. 카드 썸네일·뷰어 헤더에 표기. |
| `grade` | int | ✓ | 학년 (3·4·5·6). |
| `sem` | enum | ✓ | 학기 (`1학기`·`2학기`). |
| `subject` | enum | ✓ | 교과 (`사회`·`과학`). 썸네일 색·아이콘 자동 결정. |
| `unit` (대단원) | string | ✓ | 대단원 분류명. 홈 단원 칩 필터 기준. |
| `unitNo` | int | ✓ | 대단원 번호(배지 `N단원` 표기용). |
| `flow` | enum | ✓ | `activity`(활동형) · `flow`(핵심용어 흐름형). 뷰어 구성·목차 라벨 결정. |
| `order` | int | ✓ | 갤러리·목록 정렬 순서 + 교과 팔레트 회전 인덱스. |
| `published` | bool | ✓ | 공개 여부. false면 카드에 `준비 중` 배지, 클릭 시 빈 상태. |
| `views` | int | | 누적 조회수(런타임 카운트). 기본 0. |
| `likes` | int | | 누적 좋아요(런타임 카운트). 기본 0. |

> 정렬·필터는 클라이언트에서 `grade && sem && subject` 1차 → `unit` 2차로 거른 뒤 `order` 오름차순.

---

## 시트 2 — `items` (콘텐츠 항목, 꾸러미당 여러 행)

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `kitId` | string | ✓ | 소속 꾸러미(`kits.id`). |
| `stage` | enum | ✓ | **활동형**: `단원안내`·`생각열기`·`탐구하기`·`확장하기` / **흐름형**: `도입`·`전개`·`정리`. 목차 그룹·단계 색 결정. |
| `type` | enum | ✓ | `intro`(개요) · `video`(영상) · `image`(이미지) · `text`(위지윅 HTML). |
| `title` | string | ✓ | 항목 제목(목차·헤더 표기). 흐름형은 핵심 용어를 제목으로 사용. |
| `desc` | string | | 항목 설명(목차 보조 텍스트). 흐름형은 영상 제목을 desc로 사용. |
| `order` | int | ✓ | 같은 stage 내 항목 정렬 순서. |
| `question` | string | | 활동형 단계별 탐구질문(stage 그룹 헤더에 💡로 표시). 그룹의 첫 항목에 기재하거나 별도 stage 메타로 관리. |
| `videoUrl` | url | type=video | YouTube URL(또는 videoId). |
| `videoTitle` | string | | 영상 제목(콘텐츠 상단 표기). 흐름형 필수. |
| `videoDesc` | string | | 영상 설명(본문 카드). |
| `start` / `end` | int | | 영상 재생 구간(초). iframe `?start=&end=`로 전달. |
| `caption` | string | | 영상·이미지 하단 캡션(출처 등). |
| `imageUrl` | url | type=image | 이미지 URL. 미지정 시 stage 색 placeholder. |
| `imageLabel` / `imageSub` | string | | 이미지 라벨·서브텍스트(placeholder/대체 텍스트). |
| `body` | html | type=text | 위지윅 본문 HTML. h3/p/strong/table 등 `.sk-rich` 스타일 적용. |

### `intro` 항목 전용 필드
개요 항목(`type=intro`, 보통 `단원안내` stage 첫 항목)은 다음을 추가로 가집니다:
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `coreIdea` | string | 핵심 아이디어. |
| `coreQuestion` | string | 핵심 질문. |
| `concepts` | string[] (`;` 구분) | 핵심 개념 칩 목록. |
| `standardCode` | string | 성취기준 코드(예: `[6사07-01]`). |
| `standardText` | string | 성취기준 본문. |

> 시트로 운영할 때 `concepts` 같은 배열·`body` 같은 긴 HTML은 한 셀에 직렬화(`;` 또는 JSON 문자열). 관리가 버거워지면 아래 마이그레이션 참고.

---

## 두 가지 꾸러미 흐름

### 활동형 (`flow = activity`)
- stage 순서: `단원안내 → 생각열기 → 탐구하기 → 확장하기`.
- 각 stage는 **탐구질문**(`question`)을 가질 수 있고, 그 아래 영상/이미지/위지윅 항목이 섞임.
- 단원안내 stage에는 보통 `intro` 항목 1개(핵심 아이디어/질문/개념/성취기준).
- 예시 꾸러미: `선사 시대와 고조선`(`ab12`).

### 핵심용어 흐름형 (`flow = flow`)
- stage 순서: `도입 → 전개 → 정리`.
- 각 항목 = **핵심 용어(`title`) + 영상제목(`videoTitle`) + 영상설명(`videoDesc`)** 카드. 전부 `type=video`.
- 탐구질문 없이 용어 흐름으로 수업 전개.
- 예시 꾸러미: `삼국의 성립과 발전`(`cd34`).

> `flow` 값 하나로 뷰어의 목차 라벨(`학습 흐름`/`핵심 용어 흐름`)과 stage 색 매핑이 갈립니다.

---

## 구동 흐름 (edumaps 방식)

```
Google Sheets (kits / items)
        │  GAS doGet  또는  빌드 시 export
        ▼
   JSON 스냅샷  (kits.json / items.json)
        │  Next/Vercel ISR(revalidate)  또는  Cloudflare Pages 정적 패치
        ▼
   정적 페이지 (홈 갤러리 / 뷰어)
        ▲
        │  런타임 카운트만 분리
   조회수·좋아요  →  Cloudflare KV/D1  또는  별도 시트 append
```

- **콘텐츠(kits/items)** 는 빌드/ISR로 정적 캐싱 — 읽기 비용 0, 빠른 로딩.
- **조회수·좋아요** 만 런타임 쓰기. KV(단순 카운터) 또는 D1(행 단위) 권장. 시트 append도 가능하나 동시성/쿼터 주의.
- **짧은 링크** `kit.dgedu.link/<shortId>` 는 `kits.id` 매핑으로 라우팅. 에듀링크 본 서비스의 단축주소 라우팅과 동일 패턴.
- 라우트: `/`(홈) · `/k/:kitId`(뷰어, 첫 항목) · `/k/:kitId/:itemId`(특정 항목).

---

## 시트가 복잡해질 때의 마이그레이션

위지윅 본문(HTML)·항목 순서·이미지가 늘면 시트 한 셀 관리가 버거워집니다. 단계적 경로:

1. **시트 유지 + 빌드 JSON 캐싱** — 가장 가벼운 시작점. 항목이 적을 때.
2. **Cloudflare D1/KV로 이전** — 에듀링크와 동일 스택. `kits`/`items` 테이블 + 카운터. 항목 수가 임계치(예: 수백 행)를 넘으면 권장.
3. **항목 본문만 마크다운/MDX + Git 관리** — 위지윅 HTML이 길고 버전 관리가 필요할 때. 메타는 D1, 본문은 파일.

> 권장 경로: **초기 = 시트 → 항목 수 임계치 초과 시 = D1 이전(②)**. 위지윅 본문이 핵심이 되면 ③ 병행.

---

## 구현 시 주의
- `intro`의 `concepts`, `text`의 `body`(HTML)는 신뢰된 편집자만 작성 → 위지윅 입력 시 **XSS 새니타이즈** 필수(프로토타입은 `dangerouslySetInnerHTML` 사용 — 프로덕션은 sanitizer 적용).
- 영상은 `?rel=0&modestbranding=1` + `start`/`end`로 구간 재생. youtube-nocookie 도메인 고려.
- 이미지가 비면 stage 색 placeholder로 graceful fallback — `imageUrl` 채우기 전까지 레이아웃 유지됨.
- 조회수 중복 카운트 방지: 세션/쿠키 단위 dedupe(프로토타입은 메모리 `_counted` 맵).
