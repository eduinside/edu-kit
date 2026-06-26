// 빌드 타임 새니타이즈 게이트 (방어 심화).
// 마크다운 변환기(markdown.ts)는 화이트리스트 태그만 생성하지만,
// 본문 HTML을 JSON에 넣기 전에 다시 한 번 검증해 위반 시 빌드를 실패시킨다.
// (클라이언트 렌더 시 DOMPurify로 한 번 더 통과 — app/lib/sanitize.client.ts)

const ALLOWED_TAGS = new Set([
  "h3", "h4", "p", "strong", "em", "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "br", "span", "div", "blockquote",
]);

const ALLOWED_DIV_CLASSES = new Set([
  "sk-callout sk-callout--warn",
  "sk-callout sk-callout--info",
]);

export class SanitizeError extends Error {}

/** 위반 시 SanitizeError throw, 통과하면 html 그대로 반환. */
export function assertSafeHtml(html: string, context = ""): string {
  if (!html) return html;
  const tagRe = /<\/?([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    if (!ALLOWED_TAGS.has(tag)) {
      throw new SanitizeError(`허용되지 않은 태그 <${tag}> ${context}`);
    }
    // 닫는 태그는 속성 없음
    if (m[0].startsWith("</")) continue;

    const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrs))) {
      const name = a[1].toLowerCase();
      const val = a[2];
      if (tag === "a" && name === "href") {
        if (!/^https?:\/\//.test(val)) {
          throw new SanitizeError(`a[href]는 http(s)만 허용: "${val}" ${context}`);
        }
      } else if (tag === "a" && (name === "rel" || name === "target")) {
        // ok
      } else if (tag === "div" && name === "class") {
        if (!ALLOWED_DIV_CLASSES.has(val)) {
          throw new SanitizeError(`허용되지 않은 div class "${val}" ${context}`);
        }
      } else {
        throw new SanitizeError(
          `허용되지 않은 속성 ${tag}[${name}] ${context}`
        );
      }
    }
    // on* 핸들러/style 차단(위 속성 화이트리스트가 이미 막지만 명시)
    if (/\son[a-z]+\s*=/i.test(attrs) || /\sstyle\s*=/i.test(attrs)) {
      throw new SanitizeError(`이벤트 핸들러/style 금지 <${tag}> ${context}`);
    }
  }
  return html;
}
