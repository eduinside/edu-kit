import glob, os
from PIL import Image

ROOT = r"D:/Hwan/Documents/Web/edu-kit"
src = glob.glob(os.path.join(ROOT, "ChatGPT Image*.png"))[0]
im = Image.open(src).convert("RGBA")
W, H = im.size
alpha = im.split()[-1]

# 흐릿한 광배 무시하고 솔리드 아이콘 경계만(알파>16)
l, t, r, b = alpha.point(lambda v: 255 if v > 16 else 0).getbbox()
cx, cy = (l + r) // 2, (t + b) // 2
side = round(max(r - l, b - t) * 1.16)  # 약간의 숨 쉴 여백
half = side // 2
L, T, R, B = cx - half, cy - half, cx + half, cy + half

# 원본에서 잘라 투명 정사각 캔버스 중앙에 배치(범위 밖은 투명)
crop_box = (max(L, 0), max(T, 0), min(R, W), min(B, H))
region = im.crop(crop_box)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(region, (crop_box[0] - L, crop_box[1] - T), region)

pub = os.path.join(ROOT, "public")
LANCZOS = Image.LANCZOS

def save_png(size, name):
    canvas.resize((size, size), LANCZOS).save(os.path.join(pub, name), optimize=True)

save_png(512, "logo.png")
save_png(192, "icon-192.png")
save_png(180, "apple-touch-icon.png")
canvas.resize((48, 48), LANCZOS).save(os.path.join(pub, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

print("tight bbox:", (l, t, r, b), "icon", (r - l), "x", (b - t))
print("square side:", side, "centered at", (cx, cy))
for f in ["logo.png", "icon-192.png", "apple-touch-icon.png", "favicon.ico"]:
    print(f, os.path.getsize(os.path.join(pub, f)), "bytes")
