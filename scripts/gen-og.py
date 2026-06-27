# 꾸러미별 OG 공유 카드(1200x630 PNG) 생성 → public/og/<id>.png
# 실행: python scripts/gen-og.py   (data/kits.json·items.json 필요 = npm run sync 후)
# 카드는 정적 자산으로 커밋 — Cloudflare 빌드에서 생성하지 않음(폰트/빌드 위험 회피).
import json, os, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og"
OUT.mkdir(parents=True, exist_ok=True)

kits = json.loads((ROOT / "data" / "kits.json").read_text(encoding="utf-8"))
items = json.loads((ROOT / "data" / "items.json").read_text(encoding="utf-8"))

vid_count = {}
for it in items:
    if it.get("type") == "video":
        vid_count[it["kit_id"]] = vid_count.get(it["kit_id"], 0) + 1

FB = "C:/Windows/Fonts/malgunbd.ttf"  # 맑은 고딕 Bold
FR = "C:/Windows/Fonts/malgun.ttf"    # 맑은 고딕 Regular
f_brand = ImageFont.truetype(FB, 34)
f_url = ImageFont.truetype(FR, 20)
f_title = ImageFont.truetype(FB, 66)
f_title_sm = ImageFont.truetype(FB, 52)
f_meta = ImageFont.truetype(FB, 30)
f_count = ImageFont.truetype(FB, 28)

# 교과 팔레트 [accent, light, ink_on_light] — design.ts와 일치
PAL = {
    "사회": ("#1f7af0", "#e0f2fe", "#0b5cbf"),
    "과학": ("#059669", "#d1fae5", "#047352"),
}
INK = "#0f172a"
SUB = "#64748b"
W, H = 1200, 630

def hx(c):
    return tuple(int(c[i:i+2], 16) for i in (1, 3, 5))

logo = None
lp = ROOT / "public" / "logo.png"
if lp.exists():
    logo = Image.open(lp).convert("RGBA").resize((60, 60))

def wrap(draw, text, font, max_w):
    lines, cur = [], ""
    for ch in text:
        t = cur + ch
        if draw.textlength(t, font=font) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines

def card(kit):
    accent, light, inkl = PAL.get(kit["subject"], PAL["사회"])
    ac, lt = hx(accent), hx(light)
    img = Image.new("RGB", (W, H), (255, 255, 255))
    px = img.load()
    # 세로 그라데이션(light top → white)
    for y in range(H):
        t = (y / H) ** 1.3
        r = int(lt[0] + (255 - lt[0]) * t)
        g = int(lt[1] + (255 - lt[1]) * t)
        b = int(lt[2] + (255 - lt[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    d = ImageDraw.Draw(img)
    # 좌측 accent 바
    d.rectangle([0, 0, 14, H], fill=ac)
    pad = 72
    # 헤더: 로고 + 워드마크
    if logo:
        img.paste(logo, (pad, 60), logo)
    d.text((pad + (76 if logo else 0), 62), "수업꾸러미", font=f_brand, fill=INK)
    d.text((pad + (76 if logo else 0), 104), "kit.dgedu.link", font=f_url, fill=accent)

    # 제목(2~3줄, 길면 작은 폰트)
    title = kit["title"]
    tf = f_title
    lines = wrap(d, title, tf, W - pad * 2)
    if len(lines) > 3:
        tf = f_title_sm
        lines = wrap(d, title, tf, W - pad * 2)[:3]
    lh = tf.size + 16
    ty = 232 if len(lines) <= 2 else 200
    for ln in lines:
        d.text((pad, ty), ln, font=tf, fill=INK)
        ty += lh

    # 하단 메타 칩 + 영상 수
    chip = f'초등 {kit["grade"]}학년 · {kit["sem"]} · {kit["subject"]}'
    cw = d.textlength(chip, font=f_meta)
    cx, cy, ch = pad, H - 104, 56
    d.rounded_rectangle([cx, cy, cx + cw + 44, cy + ch], radius=28, fill=lt)
    d.text((cx + 22, cy + (ch - f_meta.size) / 2 - 2), chip, font=f_meta, fill=inkl)
    # 단원 + 영상 수
    n = vid_count.get(kit["id"], 0)
    sub = f'{kit.get("unit","")}  ·  영상 {n}개'.strip()
    d.text((cx, cy - 40), sub, font=f_count, fill=SUB)

    img.save(OUT / f'{kit["id"]}.png', "PNG", optimize=True)

def default_card():
    # 홈/루트 링크용 기본 카드(public/og/default.png)
    ac, lt = hx("#1f7af0"), hx("#e0f2fe")
    img = Image.new("RGB", (W, H), (255, 255, 255))
    px = img.load()
    for y in range(H):
        t = (y / H) ** 1.3
        col = tuple(int(lt[i] + (255 - lt[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = col
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 14, H], fill=ac)
    pad = 72
    if logo:
        big = logo.resize((96, 96))
        img.paste(big, (pad, 150), big)
    f_big = ImageFont.truetype(FB, 92)
    f_tag = ImageFont.truetype(FR, 38)
    d.text((pad + 120, 158), "수업꾸러미", font=f_big, fill=INK)
    d.text((pad, 320), "학년·학기·교과·단원으로 찾는 수업 콘텐츠", font=f_tag, fill=SUB)
    chip = "kit.dgedu.link"
    cw = d.textlength(chip, font=f_meta)
    cy = H - 104
    d.rounded_rectangle([pad, cy, pad + cw + 44, cy + 56], radius=28, fill=lt)
    d.text((pad + 22, cy + 11), chip, font=f_meta, fill="#0b5cbf")
    img.save(OUT / "default.png", "PNG", optimize=True)

for k in kits:
    card(k)
default_card()

print(f"[OK] OG cards: {len(kits)} + default -> public/og/")
