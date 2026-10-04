"""在视频帧里搜索小红书水印特有的红色像素，用来验证裁切是否真的把水印切掉了。

小红书 Logo 的红色大约是 RGB(255, 36, 66) 一类的饱和红。
"""
import glob
import os
import sys

from PIL import Image

try:  # Windows 控制台默认 GBK，强制用 UTF-8 输出，避免中文/符号报错
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

FRAMES_DIR = sys.argv[1] if len(sys.argv) > 1 else r"shots\frames3"
# 只关心画面四角，中间的内容不参与判断
EDGE_FRACTION_X = 0.30
EDGE_FRACTION_Y = 0.22


def is_xhs_red(r, g, b):
    return r > 180 and g < 95 and b < 110 and (r - g) > 90 and (r - b) > 70


def analyse(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    ex = int(w * EDGE_FRACTION_X)
    ey = int(h * EDGE_FRACTION_Y)

    regions = {
        "左上": (0, 0, ex, ey),
        "右上": (w - ex, 0, w, ey),
        "左下": (0, h - ey, ex, h),
        "右下": (w - ex, h - ey, w, h),
    }

    hits = {}
    for name, (x0, y0, x1, y1) in regions.items():
        count = 0
        for y in range(y0, y1, 2):
            for x in range(x0, x1, 2):
                if is_xhs_red(*px[x, y]):
                    count += 1
        hits[name] = count
    return im.size, hits


def main():
    files = sorted(glob.glob(os.path.join(FRAMES_DIR, "frame-*.png")))
    if not files:
        print("没有找到帧文件:", FRAMES_DIR)
        return
    print(f"检查 {len(files)} 帧，目录 {FRAMES_DIR}\n")
    total = 0
    for f in files:
        size, hits = analyse(f)
        s = "  ".join(f"{k}={v}" for k, v in hits.items())
        bad = sum(hits.values())
        total += bad
        flag = "[有水印残留]" if bad > 0 else "[干净]"
        print(f"{os.path.basename(f):22} {size[0]}x{size[1]}  {s}   {flag}")
    verdict = "(通过)" if total == 0 else "(需要加大裁切或处理源片)"
    print(f"\n>>> 红色水印像素总计: {total}  {verdict}")


if __name__ == "__main__":
    main()
