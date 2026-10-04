"""安全写文本文件：显式 UTF-8、不写 BOM、统一 LF 换行。

为什么需要它：
Windows PowerShell 5.1 的 `Set-Content -Encoding utf8` 会写 BOM，
并且在处理非 ASCII 时可能先按 GBK 解码再编码，导致中文变成乱码。
本项目已经因为这个原因损失过两次文件（src/data/content.js、README.md）。
需要批量替换或写入含中文的文本时，一律走这个脚本，不要用 shell 重定向。

用法：
    python scripts/write-text.py <目标文件> <来源文件>
    # 把 <来源文件> 的内容按 UTF-8 无 BOM 写入 <目标文件>
"""
import io
import os
import sys


def write_text(path, text):
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return len(text)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    target, source = sys.argv[1], sys.argv[2]
    with io.open(source, encoding="utf-8") as fh:
        text = fh.read()
    n = write_text(target, text)
    print(f"写出 {target}  ({n} 字符, UTF-8 无 BOM)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
