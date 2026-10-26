"""Build optimized, responsive web assets for the portfolio site.

Reads the original renders from the resume/portfolio folder and writes
multi-width WebP + JPEG variants into public/assets/<group>/.
"""
from PIL import Image, ImageOps, ImageEnhance
import os
import sys

Image.MAX_IMAGE_PIXELS = None

# 项目根目录：从脚本自身位置推导，不写死绝对路径（可移植、不泄露用户名）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets")

# 确保能 import 同目录下的 local_config（不管从哪个 cwd 运行）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 本地素材目录：本机专属路径，从已被 gitignore 的 local_config.py 读取，
# 不写进公开仓库（避免泄露个人磁盘路径，也让新克隆的人能自行配置）。
# 新克隆的人复制 scripts/local_config.example.py 为 scripts/local_config.py 填写即可，
# 或设置 PORTFOLIO_SRC / PORTFOLIO_SRC_PORTRAIT / PORTFOLIO_SRC_CASE 环境变量。
try:
    from local_config import SRC, SRC_PORTRAIT, SRC_CASE  # noqa: F401
except ImportError:
    SRC = os.environ.get("PORTFOLIO_SRC")
    SRC_PORTRAIT = os.environ.get("PORTFOLIO_SRC_PORTRAIT", "")
    SRC_CASE = os.environ.get("PORTFOLIO_SRC_CASE", "")
    if not SRC:
        print(
            "缺少本地素材路径配置。请复制 scripts/local_config.example.py 为\n"
            "scripts/local_config.py 并填写路径，或设置 PORTFOLIO_SRC 环境变量。",
            file=sys.stderr,
        )
        sys.exit(2)

# group -> { output name: (source file, widths, jpeg quality) }
# 宽度档位必须与前端 <Pic widths={[...]}> 一一对应，否则浏览器会请求不存在的文件。
PROJ = [800, 1600, 2000]
# 「其他课程设计」的小卡片封面：卡片里的图实际只显示到约 547 CSS px，
# 按 2x 也就 1100 px 上下，再往上生成纯属浪费（原来 2000 档单张能到 960 KB）。
AUX = [400, 800, 1200]
HERO = [960, 1600, 1920, 2560]

PLAN = {
    "hero": {
        # poster 同时用于 Hero 全屏背景和「剧场设计」大卡片封面，
        # 所以要把两组尺寸档位都生成出来。
        "poster": ("透视3.png", sorted({800, 1600, 1920, 2000, 2560}), 88),
        "theater-dusk": ("透视2.png", HERO, 86),
        "theater-close": ("渲染2.png", [1600], 86),
    },
    "projects": {
        # 剧场设计
        "theater-roof": ("渲染3.png", PROJ, 84),
        "theater-siteplan": ("总平面2.png", PROJ, 86),
        # 线稿立面：原误归到「案例临摹与研究」，实为剧场的外立面（可见顶部折板与棕榈）
        "theater-elevation": ("线稿风格立面.jpg", PROJ, 84),
        "theater-rain": ("透视1.png", PROJ, 84),
        "theater-hall": ("报告厅.jpg", PROJ, 84),
        "theater-explode": ("剧场爆炸分析.jpg", PROJ, 84),
        "theater-section": ("剖透视2.jpg", PROJ, 84),
        # 运动健康社区改造
        # 注意：这几张里的「红色步行道」是这一项的识别特征（与商业改造的红色拱架不同）
        # 注意：下面这些都会在图集灯箱里放大查看，所以必须保留 PROJ 全档位，
        #       不能只按封面尺寸裁（灯箱里会糊）。
        "sport-center": ("社区中心.png", PROJ, 84),
        "sport-diagram": ("垂直交通分析.jpg", PROJ, 84),
        "sport-aerial": ("总鸟瞰.png", PROJ, 86),
        "sport-roofgarden": ("屋顶花园.png", PROJ, 84),
        "sport-plaza": ("市集.png", PROJ, 86),
        "sport-plaza2": ("鸟1市集.png", PROJ, 86),
        # 街道视角与入口（原误挂在商业建筑改造下，已按用户确认改归本项目）
        "sport-street": ("街道2.png", PROJ, 86),
        "sport-entrance": ("panyan.png", PROJ, 86),
        # 商业建筑改造
        "commercial-aerial": ("商业建筑总平.jpg", PROJ, 84),
        # 客运站设计
        "station-aerial": ("datu.jpg", AUX, 84),
        # station-section 是封面
        "station-section": ("剖面1.jpg", AUX, 84),
        # 人工岛服务站
        "island-plan": ("西人工岛总平.jpg", PROJ, 86),
        # 展板同时用作卡片封面与图集项，两种档位都生成，避免哪一边取不到
        "island-board": ("西人工岛展板.jpg", sorted({900, 1800, *PROJ}), 82),
        # 商业建筑改造的立面图（原误挂在客运站下，2026-07 修正）
        "commercial-elevation1": ("1-1立面图.jpg", PROJ, 86),
        "commercial-elevation2": ("2-2立面图.jpg", PROJ, 86),
        # 南瓜王国：两张都只在小卡片里出现
        "pumpkin-aerial": ("鸟瞰4.jpg", AUX, 84),
        "pumpkin-field": ("南瓜地.jpg", AUX, 84),
        # 修行客栈：两张都是封面
        "inn-courtyard": ("剖透视图.jpg", AUX, 84),
        "inn-facade": ("民宿立面.jpg", AUX, 84),
        "inn-plan": ("客栈总平.jpg", AUX, 84),
    },
    "misc": {
        # game 只在小卡片封面里
        "game": ("ScreenShot_〉〇〉」-〇』-〇【_〈」「』》【_《〈〈.png", AUX, 82),
        # 案例临摹：形体研究小样（源图 644x953，只有这一档）、谷物之屋的总平与立面
        # 源图存放在「案例临摹」目录
        "case-model": ("案例临摹-形体研究.png", [600], 90),
        "case-grain-plan": ("谷物之屋-总平.jpg", PROJ, 86),
        "case-grain-elev": ("谷物之屋-立面.jpg", PROJ, 86),
    },
}

# hero-sized portrait crop for the profile section
PORTRAIT_PLAN = {
    "portrait": ("微信图片_20260816153959_131_58.jpg", [600, 1200], 88),
    "portrait-alt": ("微信图片_20260816154001_132_58.jpg", [600, 1200], 88),
}


def save_variants(im, group, name, widths, quality, is_portrait=False):
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    outdir = os.path.join(OUT, group)
    os.makedirs(outdir, exist_ok=True)
    made = []
    for w in widths:
        if im.width <= w:
            scaled = im.copy()
        else:
            h = round(im.height * w / im.width)
            scaled = im.resize((w, h), Image.LANCZOS)
        webp_path = os.path.join(outdir, f"{name}-{w}.webp")
        jpg_path = os.path.join(outdir, f"{name}-{w}.jpg")
        scaled.save(webp_path, "WEBP", quality=quality, method=6)
        scaled.save(jpg_path, "JPEG", quality=quality, optimize=True, progressive=True)
        made.append((w, scaled.size, os.path.getsize(webp_path) // 1024,
                     os.path.getsize(jpg_path) // 1024))
    return made


def resolve_source(srcfile):
    """按顺序在几个素材目录里找源文件，返回第一个存在的路径。"""
    for base in (SRC, SRC_CASE, SRC_PORTRAIT):
        if not base:
            continue
        p = os.path.join(base, srcfile)
        if os.path.exists(p):
            return p
    return None


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    total = 0
    for group, items in PLAN.items():
        for name, (srcfile, widths, q) in items.items():
            if only and only not in (group, name):
                continue
            srcpath = resolve_source(srcfile)
            if not srcpath:
                print(f"MISSING  {group}/{name}  <- {srcfile}", flush=True)
                continue
            try:
                with Image.open(srcpath) as im:
                    made = save_variants(im, group, name, widths, q)
                for w, size, wk, jk in made:
                    print(f"OK  {group}/{name}-{w}  {size[0]}x{size[1]}  webp {wk}KB jpg {jk}KB", flush=True)
                    total += 1
            except Exception as exc:  # noqa: BLE001
                print(f"ERROR  {group}/{name}  {exc}", flush=True)

    for name, (srcfile, widths, q) in PORTRAIT_PLAN.items():
        if only and only not in ("portrait", name):
            continue
        srcpath = resolve_source(srcfile)
        if not srcpath:
            print(f"MISSING  portrait/{name}  <- {srcfile}", flush=True)
            continue
        with Image.open(srcpath) as im:
            made = save_variants(im, "portrait", name, widths, q)
        for w, size, wk, jk in made:
            print(f"OK  portrait/{name}-{w}  {size[0]}x{size[1]}  webp {wk}KB jpg {jk}KB", flush=True)
            total += 1

    print(f"DONE  {total} files", flush=True)


if __name__ == "__main__":
    main()
