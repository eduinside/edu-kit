import type { ReactNode } from "react";
import type { Loaded } from "../../lib/kit-content.ts";

// 뷰어 본문 자리에 보이는 '불러오는 중' / '못 불러옴 + 다시 시도' 문구. 다 받았으면 undefined.
export function loadMessage(state: Loaded<unknown>, what: string /* 조사까지: "꾸러미를" */): ReactNode | undefined {
  if (state.status === "loading") return `${what} 불러오는 중…`;
  if (state.status === "error")
    return (
      <>
        {what} 불러오지 못했어요. 인터넷 연결을 확인해 주세요.
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={state.retry}
            style={{ height: 38, padding: "0 18px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 800, color: "var(--color-brand-600)" }}>
            다시 시도
          </button>
        </div>
      </>
    );
  return undefined;
}
