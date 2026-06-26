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
3. **프로젝트 설정(톱니) > 스크립트 속성 > 속성 추가**: 이름 `GITHUB_TOKEN`, 값 = 2번 PAT.
4. (선택) `CONFIG.branch`는 기본 `main`. 검수 흐름을 원하면 `content`로 바꾸고 PR로 운영.

## 4. 발행 버튼 만들기
- **삽입 > 그림/도형**으로 "발행" 버튼 모양 추가 → 도형 우측 점 세 개 > **스크립트 할당** > `발행`.
- 또는 시트를 새로고침하면 상단에 **수업꾸러미 > GitHub에 발행** 메뉴가 생긴다(`onOpen`).

## 5. 발행하기
1. 버튼/메뉴 클릭 → **첫 실행 시 권한 동의 1회**(Google/GitHub 접근).
2. 빈 `id` 칸 자동 부여(시트에 고정) → `data/raw/*.json` 커밋.
3. push → **Cloudflare Pages 자동 빌드·배포**(수 분). 잘못된 값은 빌드 실패 → Pages 빌드 로그에서 문제 행 확인.

## ⚠️ 자동 배포 전제 — Pages ↔ GitHub 연결
GAS는 **GitHub에 커밋만** 한다. push 시 자동 빌드가 되려면 **Cloudflare Pages 프로젝트가 GitHub 레포에 연결**돼 있어야 한다.
- Cloudflare 대시보드 > Workers & Pages > `edu-kit` > Settings > **Builds & deployments**에서 GitHub `eduinside/edu-kit` 연결, 빌드 명령 `npm run build`, 출력 `dist`.
- 미연결 상태면 발행 커밋은 되지만 사이트가 갱신되지 않는다(이때는 수동 `wrangler pages deploy dist`로 반영). 자세한 절차는 [DEPLOY.md](DEPLOY.md).
