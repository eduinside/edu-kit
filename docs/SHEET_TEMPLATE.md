# 수업꾸러미 — Google Sheet 저작 가이드 (중앙 편집팀용)

편집팀은 이 구조의 Google Sheet에 입력하고 **[수업꾸러미 > GitHub에 발행]** 버튼을 누른다.
버튼(GAS, `gas/publish.gs`)이 3개 탭을 `data/raw/*.json`으로 커밋 → Cloudflare Pages 빌드가
검증·새니타이즈 후 배포한다(수 분). **잘못 입력하면 빌드가 실패해 배포되지 않는다**(안전망).

> 탭 이름은 정확히 `kits`, `items`, `stage_meta`. 1행은 헤더(아래 컬럼명 그대로). 빈 셀은 비워 둔다.
> enum 컬럼은 **데이터 확인(드롭다운)** 으로 오입력을 막는 것을 권장.

---

## 탭 1 — `kits` (꾸러미 1행 = 1꾸러미)

| 컬럼 | 필수 | 값 | 설명 |
|---|---|---|---|
| `id` | 자동 | (비워 둠) | **비워 두면 발행 시 자동 부여**(base31 4자). 한 번 부여되면 시트에 고정되어 URL이 바뀌지 않음. 짧은 링크 = `kit.dgedu.link/<id>` = 앱 경로 `/<id>` |
| `title` | ✓ | 텍스트 | 꾸러미 제목 |
| `grade` | ✓ | `3`·`4`·`5`·`6` | 학년 |
| `sem` | ✓ | `1학기`·`2학기` | 학기 |
| `subject` | ✓ | `사회`·`과학` | 교과(썸네일 색·아이콘 결정) |
| `unit` | ✓ | 텍스트 | 대단원명 |
| `unit_no` | ✓ | 정수 | 대단원 번호 |
| `flow` | ✓ | `activity`·`flow` | 활동형 / 핵심용어 흐름형 |
| `sort_order` | ✓ | 정수 | 정렬 순서(+ 교과 팔레트 회전) |
| `published` | ✓ | `TRUE`/`FALSE` | 공개 여부 |

> 조회수·좋아요는 시트가 아니라 런타임(D1)에서 집계되므로 컬럼이 없다.

## 탭 2 — `items` (콘텐츠 항목, 꾸러미당 여러 행)

공통 컬럼: `kit_id`, `item_key`(영숫자/밑줄, 꾸러미 내 고유 — URL에 사용), `stage`, `type`, `title`, `description`, `sort_order`.

- **`stage`** — 활동형: `단원안내`·`생각열기`·`탐구하기`·`확장하기` / 흐름형: `도입`·`전개`·`정리`
- **`type`** — `intro` · `video` · `image` · `text`

타입별 추가 컬럼:

| type | 추가 컬럼 |
|---|---|
| `intro` | `core_idea`, `core_question`, `concepts`(`;`로 구분), `standard_code`, `standard_text` |
| `video` | `video_url`(전체 유튜브 URL), `start_sec`, `end_sec`, `video_title`, `video_desc`, `video_license`, `caption` |
| `image` | `image_url`(R2 업로드 URL), `image_label`, `image_sub`, `image_source`*, `image_license`*, `caption` |
| `text` | `body`(아래 마크다운) |

\* 이미지·영상의 출처/라이선스 미입력 시 빌드 경고(공공 저작권 보호).

### 흐름형(`flow`) 입력 요령
흐름형 항목은 모두 `type=video`. `title`에 **핵심 용어**, `video_title`에 **영상 제목**, `video_desc`에 **영상 설명**을 넣는다.
`description`은 비워 두면 빌드가 자동으로 `video_title`을 복사한다.

### `body` 마크다운(제한 문법)
시트 `body` 셀에 아래 문법만 쓴다. 빌드가 안전한 HTML로 변환한다(raw HTML 금지).

```
### 큰제목      #### 작은제목
**굵게**  *기울임*  [링크](https://example.org)
- 목록      1. 번호목록      > 인용

| 표머리1 | 표머리2 |
|---|---|
| 칸1 | 칸2 |

:::warn
노란 강조 박스(주의/정리).
:::

:::info
파란 강조 박스(생각해 보기 등).
:::
```

## 탭 3 — `stage_meta` (단계별 탐구질문)

| 컬럼 | 필수 | 설명 |
|---|---|---|
| `kit_id` | ✓ | 소속 꾸러미 |
| `stage` | ✓ | 단계명(items의 stage와 동일 표기) |
| `question` | | 탐구질문(💡). 없으면 빈 칸 |
| `sort_order` | ✓ | 단계 표시 순서 |

> 보통 활동형의 `생각열기`·`탐구하기`·`확장하기`에만 질문을 넣는다. `단원안내`와 흐름형 단계는 비워 둔다.

---

## 발행 흐름 요약
1. 시트 입력/수정 → **[수업꾸러미 > GitHub에 발행]** 클릭.
2. GAS가 `data/raw/*.json` 커밋(변경분만).
3. Cloudflare Pages 빌드: `scripts/sheet-to-json.ts`가 검증·변환·새니타이즈 → 정적 페이지 배포.
4. 오류가 있으면 빌드 실패(배포 안 됨) — Pages 빌드 로그에서 어떤 행이 문제인지 확인.

(시드 예시는 `data/raw/*.json` 참고: `ab12` 활동형, `cd34` 흐름형.)
