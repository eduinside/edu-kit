// P1: 조회수·좋아요 표시용 시드(SAMPLE_DATA). 정적 표시값.
// P3에서 D1(edukit_stats) 라이브 stats API로 대체.
export const SEED_STATS: Record<string, { views: number; likes: number }> = {
  ab12: { views: 342, likes: 57 },
  cd34: { views: 289, likes: 41 },
  ef56: { views: 210, likes: 33 },
  gh78: { views: 198, likes: 28 },
  ij90: { views: 176, likes: 22 },
  kl12: { views: 154, likes: 19 },
  mn34: { views: 233, likes: 44 },
  op56: { views: 187, likes: 30 },
  qa01: { views: 168, likes: 24 },
  qa02: { views: 142, likes: 18 },
  qa03: { views: 131, likes: 16 },
  qb01: { views: 159, likes: 27 },
  qb02: { views: 147, likes: 21 },
};

export function statsFor(id: string): { views: number; likes: number } {
  return SEED_STATS[id] ?? { views: 0, likes: 0 };
}
