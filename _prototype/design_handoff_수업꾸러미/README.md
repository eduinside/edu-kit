# Handoff: 수업꾸러미 (Class Material Kit) — 단원별 수업 콘텐츠 뷰어

## Overview
**수업꾸러미**는 대구광역시교육청 교사가 *학년·학기·교과·단원*으로 수업 콘텐츠 묶음(꾸러미)을 찾아, 한 화면에서 영상·이미지·읽기자료·활동을 순서대로 펼쳐 보는 웹 서비스입니다. 각 꾸러미는 짧은 링크(`kit.dgedu.link/<shortId>`)로 공유되며, 조회수·좋아요로 활용도를 가볍게 추적합니다.

두 가지 꾸러미 흐름을 지원합니다.
- **활동형(activity)** — `단원안내 → 생각열기 → 탐구하기 → 확장하기` 단계로 구성, 단계마다 탐구질문 + 영상/이미지/위지윅 본문이 섞임.
- **핵심용어 흐름형(flow)** — `도입 → 전개 → 정리` 수업 단계별로 *핵심 용어 + 영상제목 + 영상설명* 카드가 이어짐.

## About the Design Files
이 번들의 파일(`수업꾸러미.dc.html`)은 **HTML로 만든 디자인 레퍼런스**입니다 — 의도한 외관·동작을 보여 주는 프로토타입이며, 그대로 복사해 배포하는 프로덕션 코드가 아닙니다. 작업은 이 디자인을 **대상 코드베이스의 기존 환경**(에듀링크 스택 = React 19 + React Router 7 + TailwindCSS 4 + HeroUI + lucide-react, Cloudflare Workers/D1/KV)에서 재현하는 것입니다. 환경이 아직 없다면 가장 적합한 프레임워크를 선택해 구현하세요. `.dc.html`은 자체 런타임(`support.js`)으로 동작하는 사내 디자인 컴포넌트 포맷이므로, **로직과 데이터 구조를 참고**하되 마크업은 대상 프레임워크로 다시 작성합니다.

## Fidelity
**High-fidelity (hifi).** 최종 색상·타이포·간격·인터랙션이 모두 확정된 픽셀 단위 목업입니다. 에듀링크 디자인 시스템(Codeit blue `#3692ff`, Pretendard, gemini gradient backdrop, soft glassmorphism)을 그대로 따릅니다. 개발자는 코드베이스의 기존 디자인 시스템 컴포넌트(Button, Card, Chip, Input, SegmentedControl 등)로 픽셀에 가깝게 재현하세요.

---

## Screens / Views

앱은 **단일 페이지 + 해시 라우팅** 2개 화면(홈 갤러리 / 꾸러미 뷰어) + 1개 모달(데이터 구조)로 구성됩니다.

### 1. 홈 갤러리 (`#/`)
- **Purpose**: 교사가 학년·학기·교과·단원을 골라 해당 조건의 수업꾸러미 카드를 탐색하고, 카드를 눌러 뷰어로 진입.
- **Layout**:
  - 상단 sticky **헤더**(높이 58px, frosted glass `rgba(255,255,255,.74)` + `blur(16px)`, 하단 hairline `rgba(226,232,240,.8)`): 좌측 로고(30px 라운드 9px 타일, 브랜드 gradient, 흰색 chain-link 아이콘) + 워드마크 `수업꾸러미`(900, 18px, `-.02em`) + 서브 `kit.dgedu.link`(mono, 10px, brand-600). 우측: `데이터 구조` 버튼(flat/sm). **주의: 이전 헤더 우측에 있던 '대구광역시교육청' 라벨은 제거됨.**
  - 본문 컨테이너 `max-width:1200px; padding:34px 28px 64px`.
  - **인트로 블록**: 작은 pill 배지(brand-50, "학년·학기·교과·단원으로 찾는 수업 콘텐츠") + h1 `오늘 수업, 어떤 꾸러미로 열까요?`(800, 40px, `-.025em`) + 서브카피(15px, slate-500).
  - **필터 카드**(흰 카드, border slate-100, radius 16, shadow-sm, padding 18/20): 한 줄에 `학년`(SegmentedControl 3·4·5·6학년) · `학기`(1·2학기) · `교과`(사회·과학), 사이에 24px 세로 구분선. 그 아래 1px 구분선, `단원` 라벨 + 칩 형태의 대단원 필터 버튼들(전체 + 대단원명).
  - **결과 헤더 행**: 좌측 `수업꾸러미 N개`(13px, 700, slate-500), 우측 컨텍스트 `초등 5학년 · 2학기 · 사회`(12px, slate-400).
  - **카드 그리드**: `grid-template-columns: repeat(auto-fill, minmax(252px, 1fr)); gap:18px`.
  - 조건에 결과가 없으면 빈 상태 카드(점선 border, 🗂️, "5학년 2학기 사회 보기" 버튼으로 샘플 이동).
- **꾸러미 카드 컴포넌트**:
  - 흰 카드, border slate-100, radius 14, shadow-sm. hover 시 `shadow-md` + border brand-200 + `translateY(-3px)`(200ms), 진입 시 `sk-rise`(8px→0, .3s).
  - 상단 **썸네일**(aspect 16:9): 교과별 gradient 배경(사회=블루/인디고/스카이 팔레트, 과학=에메랄드/틸/그린 팔레트, `order`로 팔레트 회전). 좌상단 교과 배지 pill(흰 반투명, 교과 lucide 아이콘 + `교과 · N단원`), 우하단 흐릿한 교과 워터마크 SVG(opacity .16), 하단 큰 제목(800, 19px, 팔레트 accent 색). 미공개면 우상단 `준비 중` 배지, 흐름형이면 `⚡ 핵심용어 흐름` 배지.
  - 하단 메타(padding 13/15): 대단원명(11.5px, slate-400). 그 아래 카운트 행(👁 조회수 · ♥ 좋아요 · 우측 `/shortId` mono brand-600). `showCounts` prop으로 토글.

### 2. 꾸러미 뷰어 (`#/k/<kitId>` 또는 `#/k/<kitId>/<itemId>`)
- **Purpose**: 선택한 꾸러미의 학습 흐름을 좌측 목차로 탐색하고, 우측 본문에서 항목(개요/영상/이미지/글)을 봄. 좋아요·링크 복사 가능.
- **Layout**: `position:fixed; inset:0`로 전체 화면 덮음, 세로 flex.
  - **상단 바**(높이 60px, 흰 배경, 하단 border slate-100, shadow-xs):
    - 좌측: 뒤로가기 원형 버튼(36px, border slate-200) + crumb(`초등 5학년 · 2학기 · 사회`, 11px, slate-400) + 제목(800, 18px, `-.02em`, ellipsis).
    - 우측: **링크 복사 버튼**(pill, slate-50, 링크 아이콘 + `링크 복사`/`복사됨!` 라벨 — **긴 링크 텍스트는 노출하지 않음**, 클릭 시 `https://kit.dgedu.link/<id>`를 클립보드 복사) · 조회수 pill(👁) · 좋아요 토글 버튼(♥, 활성 시 danger-50/danger 색 + `sk-pop` 애니메이션).
  - **본문 영역**(flex:1, 가로 flex):
    - **좌측 사이드바 목차**(width 330px, 흰 배경, 우측 border, 스크롤): 상단 라벨(`학습 흐름`/`핵심 용어 흐름`) + `접기` 버튼. 단계 그룹마다 stage pill(단계별 색) + 옵션 탐구질문(💡), 그 아래 항목 버튼들(타입 배지 `영상/이미지/개요/글` + 제목 + 설명). 활성 항목은 brand-50 배경 + 좌측 3px brand-500 인디케이터.
    - **사이드바 접힘 시**: 목차 버튼이 **본문 sticky 헤더 안 stage 행 좌측에 인라인으로** 표시됨(제목을 가리지 않도록 — 절대배치 floating 버튼은 제거됨).
    - **우측 콘텐츠**(flex:1, 스크롤, 배경 paper `#f3f5f9`): 상단 sticky 서브헤더(frosted, stage pill + 옵션 탐구질문 + 항목 제목 21px/800). 본문 `max-width:1080px; padding:26px 32px 80px`.
  - **콘텐츠 타입별 본문**:
    - `intro(개요)`: 2열 카드(핵심 아이디어 / 핵심 질문) + 핵심 개념 칩들 + 성취기준 박스(brand-50, 성취기준 코드 mono + 본문).
    - `video(영상)`: 옵션 영상 제목 행 + 16:9 YouTube iframe(`?rel=0&modestbranding=1` + start/end) + 옵션 영상 설명 카드 + 옵션 caption.
    - `image(이미지)`: stage 색 gradient placeholder(16:10, 아이콘 + 라벨 + 서브) + caption 행. **실제 이미지 URL로 교체 필요.**
    - `text(위지윅)`: 흰 카드 안 HTML 본문(`.sk-rich` 스타일 — h3/p/strong/table 포함).
    - `empty`: 콘텐츠 준비 중 안내.

### 3. 데이터 구조 모달
- 홈 헤더 `데이터 구조` 버튼으로 열림. brand-600 헤더 바 + 흰 본문, scrim `rgba(15,23,42,.42)` + blur. `kits`/`items` 시트 컬럼 표 + 구동 흐름/대안 메모. (상세는 `DATA_MODEL.md` 참고.)

---

## Interactions & Behavior
- **라우팅**: `location.hash` 기반. `#/` = 홈, `#/k/<kitId>` = 뷰어(첫 항목 자동 선택), `#/k/<kitId>/<itemId>` = 특정 항목. `hashchange` 리스너로 상태 동기화. 대상 코드베이스에서는 React Router 경로(`/k/:kitId/:itemId?`)로 재현 권장.
- **필터**: 학년/학기/교과 변경 시 `unit`(대단원)을 `전체`로 리셋. 필터는 클라이언트에서 `KITS` 배열을 `grade && sem && subject`로 거른 뒤 `unit`으로 2차 필터.
- **조회수 카운트**: 뷰어 진입(해시가 viewer)마다 `countView(id)` 호출, 세션 내 중복 방지(`_counted` 맵). 프로토타입은 로컬 increment만; 실제로는 런타임 카운트 저장(아래 State 참고).
- **좋아요**: 토글, 낙관적 업데이트(`liked` 맵 + `likesAdd` 델타). 활성 시 하트 채움 + `sk-pop`(scale 1→1.35→1, .4s).
- **링크 복사**: `navigator.clipboard.writeText('https://kit.dgedu.link/'+id)`, 1.6초간 라벨 `복사됨!`로 전환.
- **사이드바 접기/펼치기**: `sidebarOpen` 토글. 접으면 본문 헤더에 인라인 `목차` 버튼 노출.
- **애니메이션**: 결과/본문 진입 `sk-rise`(.3s ease-out). 전이는 200–300ms ease 일관. bounce/parallax/무한 루프 없음.

## State Management
프로토타입 `this.state` 기준 — 대상 앱에서 상응하는 상태/스토어로 매핑:
- `grade`(number), `semester`(string), `subject`(string), `unit`(string) — 홈 필터.
- `route`({ view, kitId, itemId }) — 해시 파싱 결과.
- `selItem`(string|null) — 뷰어 현재 항목.
- `sidebarOpen`(bool).
- `liked`(map id→bool), `likesAdd`(map id→delta), `viewsAdd`(map id→delta) — 낙관적 카운트.
- `showData`(bool), `copied`(bool).

**데이터 페칭**: 빌드 시 또는 런타임에 시트/DB → JSON 스냅샷으로 `kits`/`items` 로드. 조회수·좋아요만 런타임 쓰기(KV/D1 또는 시트 append). 상세 흐름은 `DATA_MODEL.md`.

## Design Tokens
에듀링크 디자인 시스템 토큰을 그대로 사용 (`_ds/.../tokens/*.css`). 핵심 값:
- **Brand(Codeit blue)**: brand-50 `#eff6ff` 계열 · brand-500 `#3692ff` · **brand-600 `#1f7af0`(primary)** · brand-700 `#1763d0`(hover).
- **Neutral**: ink `#1f2937` · paper `#f3f5f9` · line `#e2e6ee` + Tailwind slate ramp(slate-100/200/400/500/600/700).
- **Semantic**: success `#059669` · danger `#e11d48` · warning `#d97706` · info `#0284c7` · violet `#7c3aed`.
- **교과 썸네일 팔레트**(gradient `[from, to, accent]`):
  - 사회: `[#e0f2fe,#c7e0ff,#1f7af0]` / `[#eef2ff,#e0e7ff,#4f46e5]` / `[#ecfeff,#cffafe,#0369a1]`
  - 과학: `[#d1fae5,#a7f3d0,#059669]` / `[#f0fdfa,#ccfbf1,#0d9488]` / `[#f0fdf4,#dcfce7,#16a34a]`
- **단계 색**(stage soft/text): 단원안내 slate-100/slate-600 · 생각열기 warning-50/700 · 탐구하기 brand-50/700 · 확장하기 success-50/700 · 도입 `#f0f9ff`/`#0369a1` · 전개 brand-50/700 · 정리 success-50/700.
- **Radius**: 6(칩) · 8(인풋/탭) · 9999(pill 버튼·배지) · 12·13·14(카드) · 16·18(모달/히어로).
- **Shadow**: shadow-xs/sm/md/lg/xl(slate 4–14% alpha), primary 글로우 `0 6px 18px rgba(31,122,240,.20)`.
- **Type**: Pretendard 단일 패밀리. 본문 500 / 라벨·제목 700 / 히어로·숫자 800 / 워드마크 900. mono 스택은 shortId·코드. 히어로 40·48, 제목 18–21, 본문 13–15, 라벨 11–12, 캡션 9–11.

## Assets
- **로고**: 인라인 SVG chain-link(브랜드 gradient 타일). 프로덕션은 `assets/edulink_logo.png` 또는 벡터 마스터 사용.
- **아이콘**: lucide(eye, heart, link, chevron-left, chevrons-left, menu, x, play, image, landmark(사회), flask-conical(과학) 등). 본 프로토타입은 인라인 SVG로 lucide 글리프를 옮겨 그림 — 대상 앱은 `lucide-react`로 교체.
- **이미지 콘텐츠**: 현재 모두 gradient placeholder. 실제 유물/사진 URL을 `items.imageUrl`로 채워야 함(예: 국립중앙박물관 소장 유물 등).
- **영상**: YouTube 임베드. 프로토타입은 동일 데모 영상 ID(`aqz-KE-bpKQ`) 사용 — 실제 영상 URL로 교체 필요.

## Files
- `수업꾸러미.dc.html` — 전체 디자인(홈/뷰어/데이터 모달) + 샘플 데이터. 마크업·로직·토큰 사용의 단일 레퍼런스.
- `DATA_MODEL.md` — 시트/DB 스키마, 두 가지 꾸러미 흐름, 구동(ISR/Cloudflare) 흐름, 확장 시 마이그레이션 경로.
- `SAMPLE_DATA.md` — 프로토타입에 들어 있는 샘플 꾸러미·항목을 시트 행 형태로 정리(개발용 시드 데이터).

> 이 README + DATA_MODEL.md는 자체 완결적입니다 — 대화에 없던 개발자도 이 문서만으로 구현할 수 있도록 작성되었습니다.
