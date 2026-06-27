# 에듀나비 → 수업꾸러미 변환 (HTML 파싱 + 유튜브 수집)

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

## 3단계 — 꾸러미 행 생성 (유튜브 맵 확보 후)
`<단원이름>.youtube.json` 이 있으면 다시 `npm run import:edunavi` 실행 시
유튜브 URL을 병합해 `data/raw` 형식의 초안(items/kit)을 만들 수 있도록 확장 예정.
(현재는 파싱까지 — 유튜브 추출 구조 확인 후 병합 자동화를 붙입니다.)

## 수업단계 자동 추정
`⟹ (수업 중)` → 탐구하기, `(배경지식)` → 생각열기, `(수업 후)` → 확장하기 로 매핑(편집자 조정 가능).
