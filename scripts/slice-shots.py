"""把手机端整页长截图切成可查看的段。

整页截图往往上万像素高，超过看图工具的单边上限，所以按固定高度切片。

用法：
    python scripts/slice-shots.py shots/mobile/390.jpg <每段高度>
"""
import io
import os
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src = sys.argv[1]
    band = int(sys.argv[2]) if len(sys.argv) > 2 else 1800

    im = Image.open(src).convert("RGB")
    base, _ = os.path.splitext(src)
    outdir = base + "-slices"
    os.makedirs(outdir, exist_ok=True)

    w, h = im.size
    n = (h + band - 1) // band
    for i in range(n):
        top = i * band
        bottom = min(h, top + band)
        crop = im.crop((0, top, w, bottom))
        # 放大一点点便于看清小字
        scale = max(1, min(3, int(900 / max(w, 1))))
        if scale > 1:
            crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
        path = os.path.join(outdir, f"{i:02d}.jpg")
        crop.save(path, quality=86)
        print(f"{path}  y={top}-{bottom}  {crop.size[0]}x{crop.size[1]}")
    print(f"共 {n} 段，源图 {w}x{h}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
