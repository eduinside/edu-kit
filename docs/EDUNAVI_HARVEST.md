# 에듀나비 → 수업꾸러미 변환 (HTML 파싱 + 유튜브 수집)

## ⭐ 권장 — 활용가이드 URL 일괄 처리 (Claude-in-Chrome)
가장 간단: **활용가이드 URL**(`selectChnnlCntntsDocLinkInfo.do?...cntntsSn=…`)을 여러 개 주면,
로그인된 브라우저로 각 가이드를 열어 **콘텐츠 목록 + 유튜브 + 시간구간**을 한 번에 수집한다.
- 브라우저 스크립트(이 문서의 수집 코드)가 단원별 구조화 JSON을 만들어 `edunavi-guides.json` 다운로드.
- `data/edunavi/guides.json` 으로 옮긴 뒤 `npm run edunavi:rows` → `out.{kits,items,stage_meta}.tsv` (시트에 붙여넣기).
- 자동 채움: 핵심용어→concepts, 단원 목적→core_idea, 수업단계(배경지식/수업중/수업후), **영상 시간구간→start_sec/end_sec**, 유튜브 URL.
- 편집자 입력: kit의 `[단원 제목]·[학년]·[학기]·[교과]·[대단원]`(성취코드 없으면 학년/교과 비어 있음).
- 실측: 가이드 2개 → 단원 2, 영상 31, **유튜브 31/31**.

---

## (참고) 수동 2단계
에듀나비 콘텐츠 페이지는 **SSO 로그인**이 필요해서(익명 요청은 `/sso`로 리다이렉트),
서버 스크립트가 직접 유튜브 URL을 가져올 수 없다. 그래서 2단계로 한다:

1. **HTML 파싱** (서버, 자동) — 붙여넣은 단원 HTML에서 메타·콘텐츠 목록(cntntsSn 포함) 추출.
2. **유튜브 수집** (로그인된 브라우저, 1회) — 아래 콘솔 스니펫이 각 cntntsSn 페이지를 열어 유튜브 URL을 모은다.

---

## 1단계 — 단원 HTML 파싱
단원 페이지의 `<div class="contents">…</div>` HTML을 `data/edunavi/<단원이름>.html` 로 저장 후:
```bash
npm run import:edunavi
```
→ `data/edunavi/<단원이름>.parsed.json` 생성: `unit`(목적·성취기준·핵심용어·packageSn) + `items`(번호·핵심용어·cntntsSn·제목·수업단계·설명·edunavi_url).

## 2단계 — 유튜브 URL 수집 (브라우저 콘솔)
1. 크롬에서 **에듀나비에 로그인**한 상태로 `https://www.edunavi.kr` 아무 페이지를 연다.
2. F12 → Console 탭에 아래를 붙여넣고 실행한다. (`URLS`에 `parsed.json`의 `edunavi_url` 값들을 붙여넣기)

```js
(async () => {
  // ↓ parsed.json의 items[].edunavi_url 들을 여기에 붙여넣기
  const URLS = [
    "https://www.edunavi.kr/arc/ad/edunavi/arc/cc/selectChnnlCntntsVidoInfo.do?chnnlSn=344&cntntsSn=27688&packageSn=1255",
    // ... 나머지 url
  ];
  const YT = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const map = {}; let diag = null;
  for (const url of URLS) {
    const sn = (url.match(/cntntsSn=(\d+)/) || [])[1];
    try {
      const html = await (await fetch(url, { credentials: "include" })).text();
      if (/location\.href=.*sso/i.test(html)) { console.warn("로그인 필요:", sn); map[sn] = "LOGIN"; continue; }
      const m = html.match(YT);
      map[sn] = m ? "https://www.youtube.com/watch?v=" + m[1] : null;
      if (!m && !diag) diag = { sn,
        iframes: [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(x => x[1]).slice(0, 6),
        hints: [...html.matchAll(/(youtube|youtu\.be|vimeo|\.mp4|videoUrl|vidoUrl|mediaUrl|movieUrl|playUrl)[^"'\s<>]{0,50}/gi)].map(x => x[0]).slice(0, 12) };
    } catch (e) { map[sn] = "ERR"; }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("youtube map:\n" + JSON.stringify(map, null, 2));
  if (diag) console.log("진단(첫 미매칭 페이지 — 공유해 주세요):\n" + JSON.stringify(diag, null, 2));
  try { copy(JSON.stringify(map, null, 2)); console.log("→ 클립보드에 복사됨"); } catch (e) {}
})();
```

3. 출력된 JSON(`{ "27688": "https://www.youtube.com/watch?v=…", … }`)을
   `data/edunavi/<단원이름>.youtube.json` 으로 저장한다.

> **유튜브가 안 잡히면**: 스니펫이 출력한 `진단(diag)`의 `iframes`/`hints`를 공유해 주세요.
> 유튜브가 iframe이 아니라 JS/별도 API로 로드되는 구조면, 그 패턴에 맞춰 추출식을 고쳐 드립니다.
> (또는 에듀나비 영상 페이지 1개의 전체 HTML을 붙여 주시면 정확한 추출식을 만들어 드립니다.)

## 3단계 — 꾸러미 행 생성 (구현 완료 ✅)
`<단원이름>.youtube.json`(`{ "27688": "영상ID", … }`)을 두고 `npm run import:edunavi` 재실행하면
`<단원이름>.rows.json` 생성: **kits 1행 + intro + 영상 N행**(유튜브 URL 병합),
성취기준 코드에서 학년·교과 자동 추정(예 `[4사…]`→4학년·사회), 수업단계 자동.
→ 이 행들을 시트(kits/items/stage_meta)에 붙여넣고 `[단원 제목]`·`[학기]`·`[대단원]`만 채우면 발행 가능.

> **확인된 사실**: 에듀나비 콘텐츠 페이지는 `www.youtube.com` **iframe**으로 영상을 임베드한다.
> 로그인된 브라우저 컨텍스트의 `fetch(...).text()` 에서 위 정규식으로 영상 ID가 잡힌다(샘플 10/10 성공).
> Claude-in-Chrome 확장이 연결돼 있으면 이 수집을 자동으로 대신 해 줄 수 있다.

## 수업단계 자동 추정
`⟹ (수업 중)` → 탐구하기, `(배경지식)` → 생각열기, `(수업 후)` → 확장하기 로 매핑(편집자 조정 가능).
