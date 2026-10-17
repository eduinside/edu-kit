# 후보 기록 (`content/_candidates/<kit_id>.yaml`)

새 꾸러미(도덕·실과 확장)의 **영상 후보를 모아 두는 곳**이다. 빌드(`npm run data`)·`npm run check`는 `content/kits/`만 읽으므로 여기 파일은 사이트에 나가지 않는다.

- 양식·절차·수집 기준: [docs/EXPANSION_PLAN_moral-practical.md](../../docs/EXPANSION_PLAN_moral-practical.md) §3~§5
- 검사만: `npm run import -- <id> --dry` · 채택 후보를 꾸러미로: `npm run import -- <id>`
- `verdict`: Claude 1차 = 추천·보류·제외·확인필요 → 운영자 판정 = **채택**·보류·제외. `채택`은 운영자 판정 뒤에만 적고 `reviewer`를 함께 적는다.
- 판정이 끝난 뒤에도 파일은 남긴다(판정 근거 기록).
