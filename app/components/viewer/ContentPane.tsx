import { Play, Image as ImageIcon } from "lucide-react";
import type { Item, Stage } from "../../lib/data.ts";
import { stageColor } from "../../lib/design.ts";

const card = { background: "#fff", border: "1px solid var(--color-slate-100)", borderRadius: 14, boxShadow: "0 1px 2px rgba(15,23,42,.06)" } as const;

function Intro({ it }: { it: Item }) {
  return (
    <div className="sk-rise">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {[["핵심 아이디어", it.core_idea], ["핵심 질문", it.core_question]].map(([h, body]) => (
          <div key={h} style={{ ...card, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-brand-600)", letterSpacing: ".03em", marginBottom: 9 }}>{h}</div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.7, color: "var(--color-slate-700)" }}>{body}</p>
          </div>
        ))}
      </div>
      {it.concepts && it.concepts.length > 0 && (
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".03em", marginBottom: 12 }}>핵심 개념</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {it.concepts.map((c) => (
              <span key={c} style={{ padding: "7px 13px", borderRadius: 9999, background: "var(--color-brand-50)", color: "var(--color-brand-700)", fontSize: 13, fontWeight: 700 }}>{c}</span>
            ))}
          </div>
        </div>
      )}
      {it.standard_text && (
        <div style={{ display: "flex", gap: 13, padding: "18px 20px", background: "var(--color-brand-50)", border: "1px solid var(--color-brand-100)", borderRadius: 14 }}>
          {it.standard_code && <div style={{ flexShrink: 0, padding: "4px 10px", height: "fit-content", borderRadius: 8, background: "#fff", fontSize: 11, fontWeight: 800, color: "var(--color-brand-700)", fontFamily: "var(--font-mono)" }}>{it.standard_code}</div>}
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.7, color: "var(--color-slate-600)" }}>{it.standard_text}</p>
        </div>
      )}
    </div>
  );
}

function Video({ it }: { it: Item }) {
  let src = `https://www.youtube-nocookie.com/embed/${it.video_id}?rel=0&modestbranding=1`;
  if (it.start_sec) src += `&start=${it.start_sec}`;
  if (it.end_sec) src += `&end=${it.end_sec}`;
  return (
    <div className="sk-rise">
      {it.video_title && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 9999, background: "var(--color-brand-50)", color: "var(--color-brand-700)", fontSize: 11, fontWeight: 800 }}>▶ 영상</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.01em" }}>{it.video_title}</span>
        </div>
      )}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#000", boxShadow: "0 12px 32px rgba(15,23,42,.18)" }}>
        <iframe src={src} title={it.video_title || it.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      </div>
      {it.video_desc && (
        <div style={{ marginTop: 14, padding: "16px 18px", ...card, borderRadius: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em", marginBottom: 7 }}>영상 설명</div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.75, color: "var(--color-slate-600)" }}>{it.video_desc}</p>
        </div>
      )}
      {it.caption && <Caption text={it.caption} />}
    </div>
  );
}

function ImageBlock({ it, stage }: { it: Item; stage: Stage }) {
  const st = stageColor(stage);
  return (
    <div className="sk-rise">
      {it.image_url ? (
        <img src={it.image_url} alt={it.image_label || it.title} loading="lazy" decoding="async" style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 14, boxShadow: "0 8px 24px rgba(15,23,42,.1)", border: "1px solid var(--color-slate-100)" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: st.text, boxShadow: "0 8px 24px rgba(15,23,42,.1)", background: `linear-gradient(135deg, ${st.soft} 0%, #ffffff 120%)`, border: "1px solid var(--color-slate-100)" }}>
          <ImageIcon size={64} strokeWidth={1.3} style={{ opacity: 0.55 }} />
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 14 }}>{it.image_label}</div>
          {it.image_sub && <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginTop: 5 }}>{it.image_sub}</div>}
        </div>
      )}
      {it.caption && <Caption text={it.caption} />}
    </div>
  );
}

function Caption({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "11px 15px", ...card, borderRadius: 11 }}>
      <Play size={14} style={{ color: "var(--color-brand-500)", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-slate-500)" }}>{text}</span>
    </div>
  );
}

function Text({ it }: { it: Item }) {
  // body는 빌드 타임 새니타이즈 완료(scripts/sanitize.ts). P3에서 클라 DOMPurify 추가 예정(§9.1).
  return (
    <div className="sk-rise" style={{ ...card, borderRadius: 16, padding: "30px 34px" }}>
      <div className="sk-rich" dangerouslySetInnerHTML={{ __html: it.body ?? "" }} />
    </div>
  );
}

export default function ContentPane({ item, stage }: { item: Item | null; stage: Stage }) {
  if (!item) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-slate-600)" }}>이 수업꾸러미는 콘텐츠가 준비 중입니다</div>
      </div>
    );
  }
  if (item.type === "intro") return <Intro it={item} />;
  if (item.type === "video") return <Video it={item} />;
  if (item.type === "image") return <ImageBlock it={item} stage={stage} />;
  return <Text it={item} />;
}
