#!/usr/bin/env python3
# 에듀나비 아카이브 코드(예: E24718) → 콘텐츠 페이지 → 임베드된 유튜브 링크 추출·정규화.
# 실행: python scripts/edunavi-youtube-extractor.py E24718 E24719 ...
#      python scripts/edunavi-youtube-extractor.py --file codes.txt --out result.csv
#
# 코드 규칙: 접두 문자(E, S 등)는 무시하고 숫자만 cntntsSn으로 쓴다. chnnlSn은 항상 346 고정.
# (이 세션의 네트워크 정책은 edunavi.kr 접속을 차단하므로, 이 스크립트는 로컬 환경에서 실행할 것.)

import argparse
import csv
import re
import sys
import time
import urllib.error
import urllib.request

CHNNL_SN = 346
ARCHIVE_URL_TMPL = (
    "https://www.edunavi.kr/arc/ad/edunavi/arc/cc/"
    "selectChnnlCntntsVidoInfo.do?chnnlSn={chnnl_sn}&cntntsSn={cntnts_sn}"
)
YOUTUBE_ID_RE = re.compile(
    r"(?:youtube(?:-nocookie)?\.com/(?:embed/|v/|watch\?v=)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def code_to_cntnts_sn(code: str) -> str:
    """'E24718' -> '24718' (접두 문자 무시, 숫자만)."""
    digits = re.sub(r"\D", "", code)
    if not digits:
        raise ValueError(f"코드에서 숫자를 찾을 수 없음: {code!r}")
    return digits


def code_to_archive_url(code: str, chnnl_sn: int = CHNNL_SN) -> str:
    cntnts_sn = code_to_cntnts_sn(code)
    return ARCHIVE_URL_TMPL.format(chnnl_sn=chnnl_sn, cntnts_sn=cntnts_sn)


def fetch_html(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def extract_youtube_url(html: str) -> str:
    """본문에서 유튜브 embed/링크를 찾아 정규 watch URL로 변환. 없으면(mp4 등) 빈 문자열."""
    m = YOUTUBE_ID_RE.search(html)
    if not m:
        return ""
    video_id = m.group(1)
    return f"https://www.youtube.com/watch?v={video_id}"


def process_code(code: str, chnnl_sn: int = CHNNL_SN) -> dict:
    archive_url = code_to_archive_url(code, chnnl_sn)
    try:
        html = fetch_html(archive_url)
        youtube_url = extract_youtube_url(html)
    except urllib.error.URLError as e:
        return {
            "code": code,
            "archive_url": archive_url,
            "youtube_url": "",
            "error": str(e),
        }
    return {
        "code": code,
        "archive_url": archive_url,
        "youtube_url": youtube_url,
        "error": "" if youtube_url else "임베드된 유튜브를 찾지 못함(mp4 등일 수 있음)",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="에듀나비 아카이브 코드 → 임베드 유튜브 링크 추출"
    )
    parser.add_argument("codes", nargs="*", help="예: E24718 E24719")
    parser.add_argument("--file", help="코드가 줄바꿈으로 나열된 텍스트 파일")
    parser.add_argument("--chnnl-sn", type=int, default=CHNNL_SN, help="채널 번호(기본 346)")
    parser.add_argument("--out", help="결과를 CSV로 저장할 경로(생략 시 표준출력)")
    parser.add_argument("--delay", type=float, default=0.5, help="요청 간 대기 초(기본 0.5)")
    args = parser.parse_args()

    codes = list(args.codes)
    if args.file:
        with open(args.file, encoding="utf-8") as f:
            codes += [line.strip() for line in f if line.strip()]
    if not codes:
        parser.error("코드를 하나 이상 지정하거나 --file을 사용하세요.")

    rows = []
    for i, code in enumerate(codes):
        if i > 0:
            time.sleep(args.delay)
        row = process_code(code, args.chnnl_sn)
        rows.append(row)
        print(
            f"{row['code']}: {row['youtube_url'] or '(없음)'}"
            + (f"  [{row['error']}]" if row["error"] else ""),
            file=sys.stderr,
        )

    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["code", "archive_url", "youtube_url", "error"]
            )
            writer.writeheader()
            writer.writerows(rows)
    else:
        writer = csv.DictWriter(
            sys.stdout, fieldnames=["code", "archive_url", "youtube_url", "error"]
        )
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
