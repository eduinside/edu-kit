import { useState } from "react";
import { Check, X, RotateCcw, Brain } from "lucide-react";
import { pickTwo, type QuizItem } from "../../lib/quiz.ts";

const card = { background: "#fff", border: "1px solid var(--color-slate-100)", borderRadius: 14, boxShadow: "0 1px 2px rgba(15,23,42,.06)" } as const;

// 개념 확인 OX 퀴즈 — 단원 마지막 화면. 진입/다시풀기마다 풀에서 2문제 무작위(quiz.pickTwo).
export default function QuizPane({ quiz }: { quiz: QuizItem[] }) {
  const [picks, setPicks] = useState<QuizItem[]>(() => pickTwo(quiz));
  const [answers, setAnswers] = useState<Record<number, "O" | "X">>({});

  function answer(idx: number, choice: "O" | "X") {
    if (answers[idx]) return; // 이미 응답 — 잠금
    setAnswers((a) => ({ ...a, [idx]: choice }));
  }
  function reroll() {
    setPicks(pickTwo(quiz));
    setAnswers({});
  }

  const answeredCount = Object.keys(answers).length;
  const allDone = answeredCount === picks.length;
  const correctCount = picks.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <div style={{ ...card, borderRadius: 16, padding: "30px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: "var(--color-brand-50)", color: "var(--color-brand-600)" }}><Brain size={17} /></span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--color-ink)", letterSpacing: "-.01em" }}>개념 확인</h3>
      </div>
      <p style={{ margin: "0 0 22px", fontSize: 13, fontWeight: 600, color: "var(--color-slate-500)" }}>설명이 맞으면 <b style={{ color: "var(--color-success-700)" }}>O</b>, 틀리면 <b style={{ color: "var(--color-danger)" }}>X</b>를 눌러 보세요.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {picks.map((q, i) => (
          <QuestionCard key={`${q.statement}-${i}`} q={q} idx={i} chosen={answers[i]} onAnswer={answer} />
        ))}
      </div>

      {allDone && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 22, padding: "14px 18px", borderRadius: 13, background: "var(--color-brand-50)", border: "1px solid var(--color-brand-100)" }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--color-brand-700)" }}>
            {picks.length}문제 중 <span style={{ color: "var(--color-brand-600)" }}>{correctCount}개</span> 정답 🎉
          </span>
          <button type="button" onClick={reroll} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 15px", borderRadius: 9999, border: "1px solid var(--color-brand-200)", background: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: "var(--color-brand-600)" }}>
            <RotateCcw size={14} /> 다시 풀기
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ q, idx, chosen, onAnswer }: { q: QuizItem; idx: number; chosen?: "O" | "X"; onAnswer: (i: number, c: "O" | "X") => void }) {
  const answered = !!chosen;
  const correct = chosen === q.answer;
  return (
    <div style={{ border: "1px solid var(--color-slate-100)", borderRadius: 14, padding: "18px 20px", background: "var(--color-paper)" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 7, background: "var(--color-slate-100)", fontSize: 12, fontWeight: 800, color: "var(--color-slate-500)" }}>{idx + 1}</span>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.6, color: "var(--color-ink)" }}>{q.statement}</p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {(["O", "X"] as const).map((opt) => {
          const isChoice = chosen === opt;
          const isAnswer = q.answer === opt;
          // 응답 후: 정답은 초록, 내가 고른 오답은 빨강, 나머지는 흐리게
          let bg = "#fff", bd = "var(--color-slate-200)", fg = "var(--color-slate-600)";
          if (answered) {
            if (isAnswer) { bg = "var(--color-success-50)"; bd = "var(--color-success-600)"; fg = "var(--color-success-700)"; }
            else if (isChoice) { bg = "var(--color-danger-50)"; bd = "var(--color-danger-100)"; fg = "var(--color-danger)"; }
            else { fg = "var(--color-slate-300)"; bd = "var(--color-slate-100)"; }
          }
          return (
            <button key={opt} type="button" disabled={answered} onClick={() => onAnswer(idx, opt)} aria-label={opt === "O" ? "맞다" : "틀리다"}
              style={{ flex: 1, height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, border: `2px solid ${bd}`, background: bg, color: fg, cursor: answered ? "default" : "pointer", fontSize: 22, fontWeight: 800, transition: "all .15s ease" }}>
              {opt === "O" ? <Check size={24} /> : <X size={24} />}
              <span style={{ fontSize: 16 }}>{opt === "O" ? "맞다" : "틀리다"}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div style={{ display: "flex", gap: 9, marginTop: 13, padding: "12px 14px", borderRadius: 11, background: correct ? "var(--color-success-50)" : "var(--color-danger-50)", border: `1px solid ${correct ? "var(--color-success-100, #d1fae5)" : "var(--color-danger-100)"}` }}>
          <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: correct ? "var(--color-success-700)" : "var(--color-danger)" }}>{correct ? "정답!" : "오답"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "var(--color-slate-600)" }}>
            정답은 <b style={{ color: "var(--color-ink)" }}>{q.answer === "O" ? "맞다(O)" : "틀리다(X)"}</b>{q.explain ? ` — ${q.explain}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
