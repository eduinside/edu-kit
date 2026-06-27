import { Fragment, type ReactNode } from "react";

// 텍스트에서 검색어(hl) 일치 부분을 <mark>로 강조. hl 없으면 원문 그대로.
export function hi(text: string | undefined | null, hl: string | undefined): ReactNode {
  const t = text ?? "";
  const q = (hl ?? "").trim();
  if (!q || !t) return t;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = t.split(new RegExp(`(${esc})`, "gi"));
  const ql = q.toLowerCase();
  return parts.map((p, i) =>
    p && p.toLowerCase() === ql ? <mark key={i} className="sk-hl">{p}</mark> : <Fragment key={i}>{p}</Fragment>
  );
}
