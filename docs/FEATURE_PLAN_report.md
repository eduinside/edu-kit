# 영상 신고 단추 + 알림 메일 (S4)

> 작성 2026-10-02 · 운영자 결정: **신고는 D1에 쌓고, 들어오면 운영자에게 메일로 알린다**(2번 안).
> 처리는 Claude에게 "신고 확인해 줘" — 진단·제안 뒤 운영자 승인을 받고 고친다(수업나래 문의함과 같은 방식).
> 관련: [IMPROVEMENT_PLAN_claude-ops.md](IMPROVEMENT_PLAN_claude-ops.md) §4 S4, [OPERATIONS.md](OPERATIONS.md) §3-7

## 1. 화면

- **영상 화면 머리**(제목·설명·출처 아래)에 작은 글자 단추 **「문제 알리기」**를 둔다.
- 누르면 작은 창이 열린다.
  - 이유 셋 중 하나를 고른다: 영상이 재생되지 않아요 / 수업에 알맞지 않은 내용이 있어요 / 그 밖의 문제
  - 메모(선택, 300자)를 적을 수 있고, 칸 아래에 "이름·연락처는 적지 마세요"를 둔다.
  - [보내기]를 누르면 "알려 주셔서 고맙습니다. 운영자가 확인할게요."가 나온다.
- 로그인은 없다. 학생도 누를 수 있다고 보고 문장을 쉽게 쓴다.

## 2. 서버 — `POST /api/kits/:id/report` (Pages Functions)

- **받는 값**
  - `item`: 영상 key
  - `reason`: `play` · `inappropriate` · `other`
  - `note`: 300자까지
  - 메일 표시용 `kitTitle`·`itemTitle`·`videoId` — 화면이 보내는 값이라 저장·표시에만 쓴다
  - 숨은 칸 `website`(스팸 봇 거르기)
- **저장**: 공유 D1 `edu-link-db`의 `edukit_reports`(아래). 표가 없으면 첫 신고 때 `CREATE TABLE IF NOT EXISTS`로 만든다(edu-dic와 같은 방식). 따로 운영 DB에 명령을 칠 필요가 없다.
- **중복·남용 막기**
  - 같은 방문자·영상·이유는 하루 1건만 받는다(유일 키).
  - 한 방문자가 하루에 보낼 수 있는 신고는 10건까지다.
  - 숨은 칸이 채워진 요청은 저장하지 않고 성공처럼 응답한다.
- **개인정보**: 이름·IP를 받지 않는다. 방문자 구분은 좋아요에 이미 쓰는 무작위 쿠키 id(`ek_vid`)다. 메모에 개인정보를 적지 않도록 화면에서 안내한다.
- **알림 메일**(Resend)
  - 받는 사람은 `REPORT_EMAIL_TO`, 보내는 사람은 `REPORT_EMAIL_FROM`(기본 `수업꾸러미 <kit-noreply@dgedu.link>` — 수업나래와 같은 인증 도메인)이다.
  - 응답을 늦추지 않도록 `waitUntil`로 보낸다.
  - **하루 상한** `REPORT_EMAIL_DAILY_CAP`(기본 20)을 둔다. Resend 무료 한도(하루 100·한 달 3,000통)를 수업나래와 함께 쓰기 때문이다. 상한을 넘으면 저장만 하고, 그날 마지막 메일에 "오늘 상한에 닿음"을 적는다.
  - 비밀 값이 없으면 메일 없이 저장만 한다(빌드·미리보기가 깨지지 않게).
- 메일 본문: 단원·영상 제목·이유·메모·시각(KST), 사이트 주소(`kit.dgedu.link/<id>/<key>`)·유튜브 주소, 처리 안내 "Claude에게 '신고 확인해 줘'".

```sql
CREATE TABLE IF NOT EXISTS edukit_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_id      TEXT NOT NULL,
  item_key    TEXT NOT NULL,
  reason      TEXT NOT NULL,              -- play · inappropriate · other
  note        TEXT,
  item_title  TEXT,
  video_id    TEXT,
  visitor_id  TEXT NOT NULL,
  reported_on TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  emailed     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'new', -- new · resolved · rejected
  resolution  TEXT,
  UNIQUE (kit_id, item_key, reason, visitor_id, reported_on)
);
```

## 3. 처리(운영)

- 운영자가 "신고 확인해 줘"라고 하면 Claude가 다음 순서로 처리한다(OPERATIONS.md §3-7).
  1. D1에서 `status='new'`를 읽는다.
  2. 해당 영상에 `npm run videos -- <id>`로 실제 상태를 확인한다.
  3. 건마다 진단과 제안(교체·빼기·`embed: false`·답변 없음)을 보인다.
  4. 운영자가 승인한 건만 꾸러미를 고쳐 발행하고, D1 `status`·`resolution`을 적는다.
- 운영자가 해 줄 것(한 번)
  - Pages 비밀 값 `RESEND_API_KEY`·`REPORT_EMAIL_TO`를 설정한다. Resend 키는 수업꾸러미 전용 키를 새로 만드는 것을 권한다(따로 폐기 가능).

## 4. 확인

- 로컬: `wrangler pages dev dist` + 로컬 D1로 저장·중복·상한·숨은 칸을 확인한다. 메일 없이 저장만 되는 경로도 본다.
- 운영: 비밀 값 설정 뒤 운영자와 함께 시험 신고 1건 → 메일 도착 → D1 행 확인 → 시험 행 `status='rejected'`.
