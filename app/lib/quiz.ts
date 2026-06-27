// 개념 확인 OX 퀴즈 — 뷰어 전용(quiz.json). kit-content.ts와 마찬가지로 ViewerPage(lazy)만 import해
// 홈 번들에 섞이지 않게 분리. quiz.json은 빌드 산출물(prebuild=sheet-to-json이 생성).
import quiz from "../../data/quiz.json";
import type { QuizItem } from "../../scripts/types.ts";

export type { QuizItem };
export const QUIZ = quiz as QuizItem[];

/** 한 꾸러미의 OX 문제 풀(정렬). 2개 미만이면 퀴즈 화면 미노출(호출부에서 판정). */
export function getQuiz(kitId: string): QuizItem[] {
  return QUIZ.filter((q) => q.kit_id === kitId).sort((a, b) => a.sort_order - b.sort_order);
}

/** 풀에서 무작위 2문제(Fisher–Yates). 접속/다시풀기마다 다른 조합 — 풀 5~8개 권장. */
export function pickTwo(pool: QuizItem[]): QuizItem[] {
  if (pool.length <= 2) return pool.slice(0, 2);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, 2);
}
