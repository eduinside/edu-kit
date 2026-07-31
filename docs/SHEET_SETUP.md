# 스프레드시트 + Apps Script 발행 설정 가이드

시드가 채워진 통합문서 **[docs/수업꾸러미_시트.xlsx](수업꾸러미_시트.xlsx)** 를 기준으로,
Drive 업로드 → Google Sheets 전환 → Apps Script(GAS) 발행 버튼 연결까지 단계별 안내.
(컬럼 의미는 [SHEET_TEMPLATE.md](SHEET_TEMPLATE.md), 배포 인프라는 [DEPLOY.md](DEPLOY.md).)

> 재생성: `python scripts/gen-sheet-xlsx.py` (data/raw/*.json → xlsx).

## 1. Google Drive 업로드 → Sheets 변환
1. [drive.google.com](https://drive.google.com)에 `수업꾸러미_시트.xlsx` 업로드.
2. 파일 더블클릭 → 상단 **"Google Sheets로 열기"**(또는 파일 > Google Sheets로 저장).
3. 탭이 `kits` / `items` / `stage_meta` 인지 확인. `읽어주세요` 탭은 참고용(삭제해도 됨).
4. enum 칸(grade·sem·subject·flow·type·stage·published)은 드롭다운이 적용돼 있음.

## 2. GitHub 토큰(PAT) 발급
1. GitHub > **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
2. **Repository access**: *Only select repositories* → `eduinside/edu-kit`.
3. **Permissions > Repository permissions > Contents: Read and write**.
4. 만료일 설정 후 생성 → **토큰 값 복사**(한 번만 표시됨).

## 3. Apps Script 연결
1. 시트에서 **확장 프로그램 > Apps Script**.
2. 레포의 [`gas/publish.gs`](../gas/publish.gs) 내용을 붙여넣고 저장.
3. **파일 추가(+) > 스크립트**로 파일 하나 더 만들어 [`gas/video-check.gs`](../gas/video-check.gs) 내용을 붙여넣는다(→ [6. 영상 점검](#6-영상-점검-임베드-가능-여부)).
   - **같은 프로젝트**여야 메뉴·스크립트 속성을 공유한다. `onOpen`은 `publish.gs`에만 있어야 한다(중복 정의 금지).
4. **프로젝트 설정(톱니) > 스크립트 속성 > 속성 추가**: 이름 `GITHUB_TOKEN`, 값 = 2번 PAT.
5. (선택) `CONFIG.branch`는 기본 `main`. 검수 흐름을 원하면 `content`로 바꾸고 PR로 운영.

## 4. 발행 버튼 만들기
- **삽입 > 그림/도형**으로 "발행" 버튼 모양 추가 → 도형 우측 점 세 개 > **스크립트 할당** > `발행`.
- 또는 시트를 새로고침하면 상단에 **수업꾸러미 > GitHub에 발행** 메뉴가 생긴다(`onOpen`).

## 5. 발행하기
1. 버튼/메뉴 클릭 → **첫 실행 시 권한 동의 1회**(Google/GitHub 접근).
2. 빈 `id` 칸 자동 부여(시트에 고정) → `data/raw/*.json` 커밋.
3. push → **Cloudflare Pages 자동 빌드·배포**(수 분). 잘못된 값은 빌드 실패 → Pages 빌드 로그에서 문제 행 확인.
4. 발행할 때마다 **`log` 시트**에 한 줄(시각·실행자·성공/실패·부여된 id·커밋 탭)이 자동 기록된다(없으면 생성).

## 6. 영상 점검 (임베드 가능 여부)

`items` 탭의 모든 `video_url`이 **뷰어의 iframe에서 실제로 재생되는지** 일괄 확인한다.
발행과 완전히 분리된 기능 — GitHub·사이트를 건드리지 않고 **시트에만** 결과를 남긴다.
링크는 소리 없이 썩으므로 **2개월에 한 번 정도** 눌러 주는 것을 권장(수동 실행, 자동 트리거 없음).

### 6-1. API 키 등록 (최초 1회)
1. [Google Cloud 콘솔](https://console.cloud.google.com) > 프로젝트 선택 > **API 및 서비스 > 라이브러리**에서 **YouTube Data API v3** 사용 설정.
2. **사용자 인증 정보 > 사용자 인증 정보 만들기 > API 키** 생성.
   - 키 제한: **API 제한 → YouTube Data API v3**만 선택(애플리케이션 제한은 없음 — GAS 서버에서 호출).
3. Apps Script **프로젝트 설정 > 스크립트 속성**: 이름 `YT_API_KEY`, 값 = 위 키.

> 키는 GAS 서버에서만 쓰이고 프런트엔드에 노출되지 않는다. 단, **시트 편집 권한자는 스크립트 속성을 볼 수 있다**(GITHUB_TOKEN과 동일 조건).

### 6-2. 버튼 만들기
- **삽입 > 그림/도형**으로 "영상 점검" 버튼 추가 → 우측 점 세 개 > **스크립트 할당** > `영상점검`.
- 또는 새로고침 후 **수업꾸러미 > 영상 점검** 메뉴.

### 6-3. 결과 보는 곳
| 위치 | 내용 |
|---|---|
| `items` 탭 | 문제 있는 `video_url` **셀에 배경색 + 메모**(판정·사유). 셀 값은 안 바뀌므로 발행 JSON에 영향 없음. 정상으로 돌아오면 다음 점검에서 표시가 지워진다 |
| `video_check` 탭 | **최근 1회**의 문제 목록(items행·kit_id·item_key·title·URL·판정·상세). 매번 덮어씀 |
| `video_log` 탭 | **실행 이력 누적** — 시각·실행자·검사/정상/문제 수·판정별 요약·소요시간 |

첫 화면(안내 시트)에 발행 `LOG` 블록처럼 최근 점검 이력을 띄우려면, 원하는 셀에:

```
=IFERROR(SORT(QUERY(video_log!A2:G, "select A,B,C,E,F where A is not null"), 1, FALSE), )
```

(시각·실행자·검사수·문제수·요약 5열이 최신순으로 펼쳐진다.)

### 6-4. 판정 기준과 셀 색
`items` 탭 `video_url` 셀 색으로 **처리 방법**이 바로 구분된다 — 붉은색은 교체, 노란색은 폴백 가능.

| 판정 | 셀 색 | 뜻 | 처리 |
|---|---|---|---|
| `정상` | 없음 | iframe 재생 가능 (일부공개(unlisted)도 정상) | — |
| `삭제·비공개` | 🔴 진한 빨강 | API 응답에 없음 — 삭제됐거나 비공개 전환됨 | **교체**(또는 행 삭제) |
| `비공개` | 🔴 진한 빨강 | `privacyStatus=private` | **교체** |
| `연령제한` | 🟥 연한 빨강 | 삽입 재생 불가(로그인 요구). **학생용 부적합** | **교체** |
| `국내차단` | 🟥 연한 빨강 | KR 지역 시청 차단(음원 저작권 등) | **교체** |
| `임베드차단` | 🟡 노랑 | 업로더가 외부 삽입 차단 — 링크로는 열림 | 교체 우선, 불가하면 `video_embed=FALSE` |
| `URL오류` | ⬜ 회색 | 주소에서 11자 영상 ID를 못 뽑음 | 시트 URL 고치기 |
| `점검실패` | ⬜ 회색 | API 호출 실패(키·쿼터) | 다시 실행 |

색은 `video-check.gs`의 `VC.bgByVerdict`에서 바꿀 수 있다.

> 쿼터: id 50개를 한 번에 묶어 보내 **호출당 1 unit**. 영상 1,000개 ≈ 20 units로 일일 무료 10,000 units 대비 무시할 수준.

## ⚠️ 자동 배포 전제 — Pages ↔ GitHub 연결
GAS는 **GitHub에 커밋만** 한다. push 시 자동 빌드가 되려면 **Cloudflare Pages 프로젝트가 GitHub 레포에 연결**돼 있어야 한다.
- Cloudflare 대시보드 > Workers & Pages > `edu-kit` > Settings > **Builds & deployments**에서 GitHub `eduinside/edu-kit` 연결, 빌드 명령 `npm run build`, 출력 `dist`.
- 미연결 상태면 발행 커밋은 되지만 사이트가 갱신되지 않는다(이때는 수동 `wrangler pages deploy dist`로 반영). 자세한 절차는 [DEPLOY.md](DEPLOY.md).
