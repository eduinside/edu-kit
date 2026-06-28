// Pages 미들웨어 — 꾸러미 경로(/:kitId)의 SPA HTML에 kit별 OG 메타를 주입.
// 카카오톡/슬랙 등이 링크를 크롤할 때 제목·설명·이미지 미리보기가 뜨도록.
// (콘텐츠는 정적이므로 kit 메타를 함수에 번들 — data/kits.json은 빌드 prebuild가 생성)
import kits from "../data/kits.json";

interface KitMeta {
  id: string;
  title: string;
  unit: string;
  grade: number;
  sem: string;
  subject: string;
}

const BY_ID = new Map((kits as KitMeta[]).map((k) => [k.id, k]));

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Ctx {
  request: Request;
  next: () => Promise<Response>;
}

// 프로덕션 pages.dev 별칭 → 커스텀 도메인. 프리뷰(<hash>.edu-kit-br4.pages.dev)는 제외(정확 일치만).
const CANONICAL_HOST = "kit.dgedu.link";
const PAGES_HOST = "edu-kit-br4.pages.dev";

export const onRequest = async (context: Ctx): Promise<Response> => {
  const url = new URL(context.request.url);
  // edu-kit-br4.pages.dev 로 들어오면 같은 경로·쿼리로 커스텀 도메인으로 301 이동.
  if (url.hostname === PAGES_HOST) {
    return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301);
  }

  const res = await context.next();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res; // 자산/JSON 통과

  const first = url.pathname.split("/").filter(Boolean)[0];
  const kit = first ? BY_ID.get(first) : undefined;
  if (!kit) return res; // 홈 등은 기본 메타 유지

  const title = `${kit.title} · 수업꾸러미`;
  const desc = `초등 ${kit.grade}학년 · ${kit.sem} · ${kit.subject} · ${kit.unit}`;
  const ogUrl = `${url.origin}/${kit.id}`;
  const img = `${url.origin}/og/${kit.id}.png`; // 꾸러미별 브랜드 카드(scripts/gen-og.py 생성)
  const tags =
    `<meta property="og:type" content="article"/>` +
    `<meta property="og:site_name" content="수업꾸러미"/>` +
    `<meta property="og:title" content="${esc(title)}"/>` +
    `<meta property="og:description" content="${esc(desc)}"/>` +
    `<meta property="og:url" content="${esc(ogUrl)}"/>` +
    `<meta property="og:image" content="${esc(img)}"/>` +
    `<meta property="og:image:width" content="1200"/>` +
    `<meta property="og:image:height" content="630"/>` +
    `<meta name="twitter:card" content="summary_large_image"/>` +
    `<meta name="twitter:title" content="${esc(title)}"/>` +
    `<meta name="twitter:description" content="${esc(desc)}"/>` +
    `<meta name="twitter:image" content="${esc(img)}"/>`;

  let html = await res.text();
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  // index.html의 기본 og/twitter 메타 제거 후 꾸러미별 메타 주입(중복 방지)
  html = html.replace(/\s*<meta[^>]*(?:property="og:|name="twitter:)[^>]*>/g, "");
  html = html.replace("</head>", tags + "</head>");

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(html, { status: res.status, headers });
};
