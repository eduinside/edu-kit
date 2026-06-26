// 제한 마크다운 → .sk-rich HTML 변환 (빌드 타임).
// 편집자가 시트 body 셀에 쓰는 안전한 부분집합만 지원한다:
//   ### h3, #### h4, 문단, **굵게**, *기울임*, [텍스트](http…),
//   - / 1. 목록, > 인용, GFM 파이프 표, ::: warn|info 콜아웃 박스.
// raw HTML은 받지 않으므로(마크다운만) 출력은 항상 화이트리스트 태그만 포함한다.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 인라인 서식: 이스케이프 후 굵게/기울임/링크 적용 */
function inline(text: string): string {
  let s = escapeHtml(text);
  // 링크 [텍스트](http(s)://...) — http/https만 허용, rel/target 강제
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label, url) =>
      `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

function isTableSep(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** 블록 단위 파싱. depth는 콜아웃 내부 재귀 방지용(1단계만). */
function renderBlocks(src: string, allowCallout = true): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (!line.trim()) {
      i++;
      continue;
    }

    // 콜아웃 ::: warn | info
    const callout = line.match(/^:::\s*(warn|info)\s*$/);
    if (callout && allowCallout) {
      const kind = callout[1];
      const inner: string[] = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        inner.push(lines[i]);
        i++;
      }
      i++; // closing :::
      out.push(
        `<div class="sk-callout sk-callout--${kind}">${renderBlocks(
          inner.join("\n"),
          false
        )}</div>`
      );
      continue;
    }

    // 헤딩
    const h = line.match(/^(#{3,4})\s+(.*)$/);
    if (h) {
      const tag = h[1].length === 3 ? "h3" : "h4";
      out.push(`<${tag}>${inline(h[2])}</${tag}>`);
      i++;
      continue;
    }

    // 표 (헤더 + 구분선 + 본문)
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitCells(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header
        .map((c) => `<th>${inline(c)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`
        )
        .join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // 순서 없는 목록
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // 순서 있는 목록
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // 인용
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // 문단 (다음 빈 줄/블록 시작 전까지)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{3,4}\s|:::|\s*[-*]\s|\s*\d+\.\s|\s*>\s)/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/** 마크다운을 .sk-rich 본문 HTML로 변환 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  return renderBlocks(md.trim());
}
