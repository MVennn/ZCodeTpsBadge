#!/usr/bin/env python3
"""兼容入口：品牌资源统一由 tools/make_social_preview.py 生成。

    python tools/gen_assets.py

Outputs:
    assets/logo.png            512x512 app logo
    assets/icon.ico            multi-size Windows icon
    assets/social-preview.png  1280x640 GitHub social preview

以前这个脚本自带一套画法，与 assets/icon.svg 各画各的，两边会漂。
现在它只转调 make_social_preview.py —— 栅格资源的**唯一实现**在那边，
图形正本始终是 assets/icon.svg。

保留本文件是为了不打断既有调用（`npm run assets`、文档里的命令）。
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "tools", "make_social_preview.py")


def main():
    if not os.path.exists(TARGET):
        print("✗ 找不到 %s" % TARGET)
        return 1
    cmd = [sys.executable, TARGET, "--ico"]
    print("→", " ".join(cmd))
    return subprocess.call(cmd, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
