# 컨버팅 코워크 프롬프트 — 기존 매핑 파일 → 수업꾸러미 3탭

기존 매핑 파일(시트/CSV/문서)을 Claude 코워크에 주고 아래 프롬프트로 변환하면,
`kits` / `items` / `stage_meta` 세 탭에 붙여넣을 행을 만들어 줍니다.
**복사해서 쓰세요.** (스키마 상세는 [SHEET_TEMPLATE.md](SHEET_TEMPLATE.md).)

---

## 프롬프트 (복사)

```
너는 "수업꾸러미" 콘텐츠 변환기다. 첨부한 기존 매핑 파일을 읽고,
아래 스키마에 맞는 kits / items / stage_meta 행을 CSV 3개로 출력해라.
모르는 값은 비워 두고, 추측이 필요한 곳은 [확인필요]로 표시해라.

[목표 단위]
- 1 꾸러미(kits 1행) = 1 단원(또는 한 주제 묶음).
- 각 꾸러미는 items 여러 행(stage × type)으로 구성.

[kits 컬럼]
id(비움=자동부여) | title | grade(3~6) | sem(1학기|2학기) | subject(사회|과학)
| unit(대단원명) | unit_no(정수) | flow(activity|flow) | sort_order(정수) | published(TRUE|FALSE)

[items 컬럼]
kit_id | item_key(영숫자, 꾸러미 내 고유: intro/v1/i1/t1/f1…) | stage | type | title | description | sort_order
+ 타입별:
- intro: core_idea, core_question, concepts(";"구분), standard_code, standard_text
- video: video_url(전체 유튜브 URL), start_sec, end_sec, video_title, video_desc, video_license, caption
- image: image_url, image_label, image_sub, image_source, image_license, caption
- text : body (제한 마크다운: ### 제목 / **굵게** / 표 / - 목록 / > 인용 / :::warn / :::info)

[stage 값]
- 활동형(flow=activity): 단원안내 → 생각열기 → 탐구하기 → 확장하기
- 흐름형(flow=flow): 도입 → 전개 → 정리

[규칙]
1. 흐름형 항목은 모두 type=video. title=핵심용어, video_title=영상제목, video_desc=영상설명. description은 비우면 빌드가 video_title로 자동 채움.
2. intro 항목은 보통 '단원안내' stage의 첫 항목.
3. 영상은 전체 유튜브 URL을 video_url에. 모르면 [확인필요].
4. 본문(text body)은 raw HTML 금지, 위 마크다운만.
5. 이미지/영상의 출처·라이선스(image_source/license, video_license)는 가능하면 채운다.
6. stage_meta는 활동형의 생각열기/탐구하기/확장하기에 탐구질문이 있을 때만 채운다(단원안내·흐름형 단계는 비움). 컬럼: kit_id, stage, question, sort_order.

[출력 형식]
=== kits.csv ===
(헤더 + 행)
=== items.csv ===
(헤더 + 행)
=== stage_meta.csv ===
(헤더 + 행)

먼저 매핑 파일에서 몇 개 꾸러미를 파일럿으로 변환해 보여주고, 내가 확인하면 전체를 변환해라.
```

---

## 스크립트로 자동화하고 싶다면
구조가 규칙적이면(컬럼이 일정한 CSV/JSON) 프롬프트 대신 `scripts/import-source.ts`(스켈레톤)에
컬럼 매핑만 채워 `npm run import` 로 `data/raw/*.json`을 직접 생성할 수 있다.
생성물은 기존 ETL(`sheet-to-json.ts`)이 검증·새니타이즈하므로 잘못된 변환은 빌드에서 걸러진다.
