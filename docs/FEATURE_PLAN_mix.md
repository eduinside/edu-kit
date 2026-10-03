# 모음 화면(`/m/:id`) — 고른 영상만 모아 보는 진행 화면 (S6)

> 작성 2026-10-02 · 운영자 결정:
> - 모음은 **꾸러미 D1에 저장**하고 자체 짧은 주소 `kit.dgedu.link/m/<id>`를 쓴다.
> - **수업나래와 꾸러미 사이트 둘 다** 모음을 만든다.
> - dgedu.link 짧은 주소는 **꾸러미 서버 함수**가 만든다.
> - 화면은 **기존 뷰어를 재사용**한다.
>
> **⚠ 2026-10-03 운영자 결정으로 바뀜 — 모음을 D1에 저장하지 않는다.**
> - 꾸러미는 **데이터(공개 `/catalog.json`)와 뷰어(`/m?i=<kit>.<key>,…&t=<제목>`)만** 맡는다.
> - 모음을 고르고 묶는 일은 수업나래가 한다. 나래는 긴 주소를 만들어 직접 dgedu.link로 줄인다.
> - 꾸러미 사이트의 「모음에 담기」도 같은 `?i=` 주소를 만들고, 서버(`POST /api/shorten`)는 줄이기만 한다.
> - `POST /api/mix`·`edukit_mixes` 쓰기는 없앤다. `GET /api/mix/:id`와 `/m/:id`는 이미 만든 모음을 열기 위해 남긴다. CORS 목록의 narae도 뺀다.
> - 아래 §1~§2의 저장·한도·CORS 부분은 이 결정으로 대체된다.
> - 작업 목록: 수업나래 [REAL-LIFE-MATERIALS-PLAN.md](../../dge-narae/docs/plans/REAL-LIFE-MATERIALS-PLAN.md) §2(K1~K4)
> - **구현(10/3, 브랜치 `narae-catalog`)**:
>   - 모음 주소 `/m?i=<kit>.<key>,…&t=<제목>[&n=<안내 300자>][&v=<보는 영상>]` — `app/lib/mix.ts`의 `mixUrl`·`parseMixQuery`, `MixPage`
>   - `POST /api/shorten`(`functions/api/shorten.ts`): 같은 사이트에서만 받는다. 같은 주소는 D1 `edukit_shortens`에서 다시 돌려준다. 새로 줄이는 것은 IP 해시당 하루 30개다
>   - OG는 `t`와 첫 영상 단원 카드로 만든다(`_middleware.ts`)
>   - `POST /api/mix`(`functions/api/mix/index.ts`)를 지웠다. CORS 목록에서 narae를 뺐다
>   - 공개 카탈로그 `/catalog.json`은 `scripts/catalog.ts`가 build-data에서 만든다. 채널 등급 표는 `content/channels.yaml`(운영자 검수 완료)이다
>
> 관련: 수업나래 연계 노트 §5-3 ②(`dge-narae/docs/research/REAL-LIFE-CONTEXT-MATERIALS-NOTES.md`), [IMPROVEMENT_PLAN_claude-ops.md](IMPROVEMENT_PLAN_claude-ops.md) §4 S6

## 1. 화면

- **모음 보기 `/m/:id`, `/m/:id/:item`**: 지금 뷰어와 같은 화면이다(영화관 재생·출처·문제 알리기·이전/다음).
  - 목차는 **교사가 정한 순서 그대로**다. 같은 단원에서 이어지는 영상끼리 단원 이름표 하나로 묶는다.
  - 머리에는 모음 제목, "수업꾸러미 모음 · 영상 n개", 링크 복사(짧은 주소 우선)를 둔다.
  - 모음 안내 글(있으면)은 목차 맨 위에 보인다.
  - 나중에 꾸러미에서 빠진 영상은 건너뛴다. 남은 영상이 하나도 없으면 "이 모음의 영상을 찾을 수 없어요"를 보인다.
- **모음 만들기(꾸러미 사이트)**
  - 영상 화면 머리(출처·문제 알리기 옆)에 「＋ 모음에 담기」 / 「✓ 담김」 단추를 둔다.
  - 담은 영상이 있으면 오른쪽 아래(설문 단추 위)에 「모음 n」 단추가 뜬다. 누르면 창이 열린다.
    - 순서 바꾸기(위·아래)와 빼기
    - 제목(필수, 60자), 안내 글(선택, 300자)
    - [모음 주소 만들기] → 짧은 주소 · 꾸러미 주소 · QR · 복사 단추
  - 담은 목록은 이 브라우저(localStorage)에만 둔다. 만들고 나면 비울지 묻는다.
- **수업나래**(다음 작업): 계획안 "실생활 맥락 탐구자료"의 「수업꾸러미로 모아 보기」가 같은 API를 부른다(CORS 허용).

## 2. 서버(Pages Functions)

- `POST /api/mix`
  - 받는 값:
    - `title`: 1~60자
    - `note`: ~300자
    - `items`: `"<kit>/<key>"` 1~30개, 중복은 걸러 낸다
    - `source`: `kit` · `narae`
  - D1 `edukit_mixes`에 저장한다. 표가 없으면 첫 요청 때 만든다.
  - **dgedu.link 짧은 주소**: `DGEDU_LINK_API_KEY`가 있으면 `POST https://dgedu.link/api/v1/shorten`을 부른다.
    - 보내는 값: `original_url` = `https://kit.dgedu.link/m/<id>`, `title` = "수업꾸러미 모음 · 제목"
    - 공개 목록에는 올리지 않는다(`is_public` 생략 = 0).
    - 결과 `slug`·`short_url`을 저장한다. QR은 `https://dgedu.link/qr/<slug>`다.
    - 실패하거나 키가 없으면 꾸러미 주소만 돌려준다.
  - 남용 막기: 같은 접속(IP를 그날 날짜와 섞은 해시 — 원래 IP는 저장하지 않음)당 하루 30개까지 만든다.
  - CORS: `https://kit.dgedu.link`, `https://narae.dgedu.link`, 미리보기·로컬만 허용한다.
- `GET /api/mix/:id`: 제목·안내·영상 목록·짧은 주소를 돌려준다.
- 미들웨어: `/m/:id` HTML에 OG 메타를 넣는다(제목 = "모음 제목 · 수업꾸러미", 그림 = 첫 영상 단원의 카드).

```sql
CREATE TABLE IF NOT EXISTS edukit_mixes (
  id           TEXT PRIMARY KEY,           -- 6자(헷갈리는 글자 뺀 소문자+숫자)
  title        TEXT NOT NULL,
  note         TEXT,
  items        TEXT NOT NULL,              -- JSON ["so4122/v7", ...]
  source       TEXT NOT NULL DEFAULT 'kit',
  creator_hash TEXT NOT NULL,              -- 하루 단위 해시(남용 막기용)
  created_on   TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
  short_slug   TEXT,
  short_url    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- 모음은 만든 뒤 고치지 않는다. 바꾸려면 새로 만든다(링크가 가리키는 내용이 그대로 있게).

## 3. 뷰어 재사용

- `ViewerPage`의 화면 부분을 `ViewerShell`로 떼어 낸다.
  - 꾸러미 뷰어: 단계 묶음 + 퀴즈 + 조회수·좋아요.
  - 모음 뷰어: 단원 묶음 + 링크 복사. 같은 껍데기를 쓴다.
- 모음 안의 영상 key는 `<kit>.<key>`다(URL `/m/<id>/so4122.v7`). 신고는 원래 꾸러미·key로 간다.

## 4. 운영자가 해 줄 것

- Pages 비밀 값을 등록한다. `.env`에 있는 것과 같은 키다.
  ```bash
  npx wrangler pages secret put DGEDU_LINK_API_KEY --project-name edu-kit
  ```
- 확인: 로컬에서 모음 만들기·보기·빠진 영상·상한·CORS를 본다(가짜 키 → 짧은 주소 없이). 운영에서는 운영자와 함께 시험 모음 1개를 만들어 짧은 주소·QR이 오는지 확인한다.
