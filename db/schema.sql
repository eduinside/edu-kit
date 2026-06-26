-- 수업꾸러미 런타임 카운터 — 공유 D1 'edu-link-db'에 edukit_ 접두어로 둔다.
-- edu-link의 wrangler d1 migrations(공유 d1_migrations 트래킹)와 충돌하지 않도록
-- CREATE TABLE IF NOT EXISTS 로 멱등 적용한다:
--   wrangler d1 execute edu-link-db --remote --file=db/schema.sql
-- (로컬: --local)

-- 누적 조회수/좋아요 집계
CREATE TABLE IF NOT EXISTS edukit_stats (
  kit_id TEXT PRIMARY KEY,
  views  INTEGER NOT NULL DEFAULT 0,
  likes  INTEGER NOT NULL DEFAULT 0
);

-- 좋아요 1인 1표(멱등). PK가 중복 토글을 막는다.
CREATE TABLE IF NOT EXISTS edukit_likes (
  kit_id     TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kit_id, visitor_id)
);

-- 조회 중복 방지(1인 1일 1회). KV TTL 대신 날짜 컬럼으로 dedupe.
CREATE TABLE IF NOT EXISTS edukit_view_dedupe (
  kit_id     TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  viewed_on  TEXT NOT NULL,             -- 'YYYY-MM-DD' (UTC)
  PRIMARY KEY (kit_id, visitor_id, viewed_on)
);

-- (선택) 오래된 dedupe 행 정리는 주기 작업으로:
--   DELETE FROM edukit_view_dedupe WHERE viewed_on < date('now','-30 day');
