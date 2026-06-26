// shortId 생성 — base31(혼동 문자 0/O,1/l/I 제외). 4자 ≈ 92만 조합.
// 발행 시 GAS가 시트 빈 id 칸에 부여(gas/publish.gs). ETL은 로컬/안전망용 생성.

export const ID_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

export function randomId(len = 4): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ID_ALPHABET[b % ID_ALPHABET.length];
  return s;
}

/** 기존 id와 충돌하지 않는 새 id. 충돌 잦으면 길이 +1로 확장. */
export function generateUniqueId(existing: Set<string>, len = 4): string {
  for (let attempt = 0; attempt < 80; attempt++) {
    const id = randomId(len);
    if (!existing.has(id)) return id;
  }
  return generateUniqueId(existing, len + 1);
}
