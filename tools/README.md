# tools —— 开发期工具

> **一句话**：双击入口、CDP 备用注入、本地预览、资产生成与仓库检查都在这里；
> 每个脚本的用法见对应小节，新增脚本必须同步本文件。

这些脚本不参与徽标运行，只用于安装、调试、预览、生成资源和 CI。

## 环境变量

| 变量 | 说明 |
|---|---|
| `ZCODE_RESOURCES` | ZCode 的 `resources` 目录；覆盖 `config.local.json` |
| `ZCODE_EXE` | ZCode 可执行文件；备用启动器使用 |
| `PORT` | 预览服务端口，默认 `8766` |

路径解析顺序与配置示例见 [docs/BUILD.md](../docs/BUILD.md) §2。

## 分类总览

| 分类 | 文件 |
|---|---|
| 安装 / 还原 | `apply.cmd` · `restore.cmd` |
| 备用 CDP 模式 | `injector.mjs` · `launch-zcode-tps.cmd` · `launch-zcode-tps.vbs` |
| 本地预览 | `preview/build.mjs` · `preview/serve.mjs` |
| 品牌资源 | `make_social_preview.py`（`gen_assets.py` 是兼容入口） |
| 仓库检查 | `ci/check.mjs` |

---

## apply.cmd / restore.cmd

双击入口，内部调用 `src/patch.mjs` / `src/restore.mjs`，自动定位项目根。

```bat
tools\apply.cmd
tools\restore.cmd
```

要求 ZCode 完全退出；`apply.cmd` 支持追加 `--force`：

```bat
tools\apply.cmd --force
```

## injector.mjs

CDP 备用注入器。ZCode 需要以 `--remote-debugging-port=9222` 启动。

```bash
node tools/injector.mjs 9222
```

需要 Node.js 22+（全局 `WebSocket`）。

## launch-zcode-tps.cmd / .vbs

备用模式启动器：先起注入器，再带调试端口启动 ZCode。
`ZCODE_EXE` 或 `config.local.json` 覆盖 ZCode 路径。

## preview/build.mjs + serve.mjs

生成本地预览页并启动静态服务。

```bash
node tools/preview/build.mjs
node tools/preview/serve.mjs
# http://127.0.0.1:8766/index.html
# http://127.0.0.1:8766/light/index.html
# http://127.0.0.1:8766/index.html?test=1   # 计数夹具
```

`?test=1` 页面暴露 `__appendAssistant` / `__appendSidebar` / `__appendUser` /
`__appendTool` / `__addHistoryMessage`。

## make_social_preview.py

门面生成器：**栅格资源的唯一实现**。自己实现 SVG 渲染，不依赖 cairosvg / Inkscape，
图形正本始终是 `assets/icon.svg`，门面文案写死在脚本顶部的 `BRAND` 里，改文案不用动渲染代码。

产出：

- `assets/logo.png`（512×512）
- `assets/icon.ico`（16–256 多尺寸，需 `--ico`）
- `assets/social-preview.png`（1280×640）

```bash
python tools/make_social_preview.py                 # 写 logo.png 与 social-preview.png
python tools/make_social_preview.py --ico            # 额外写 icon.ico
python tools/make_social_preview.py --preview-only  # 只写 social-preview.png
```

需要 Pillow 与 numpy。视觉语言对齐 GoldSunEnhance 的 `assets/social-preview.png`。
品牌色与规格见 [docs/REPO-STANDARD.md](../docs/REPO-STANDARD.md) §4。

## gen_assets.py

`make_social_preview.py` 的**兼容入口**：只转调它，不另画一套。
以前它自带一套画法，与 `assets/icon.svg` 各画各的，两边会漂；现在只有一份实现。

```bash
python tools/gen_assets.py
```

新代码一律调 `make_social_preview.py`。

## ci/check.mjs

仓库检查：语法、Markdown 链接、必需文件、docs 孤儿、资源尺寸、数据源守卫、
Release 说明形状、本机路径与密钥。数据源守卫会在徽标重新引入字符估算、
tap 不再调用 `zcode-agent.readSessionDebug` 或 RPC 形状测试失败时变红
（见 [docs/CODE-RULES.md](../docs/CODE-RULES.md) §2.5/2.9，测试见
`tools/ci/test-debug-source.mjs`）。

```bash
node tools/ci/check.mjs
# 或 npm run check
```

CI 配置在 `.github/workflows/ci.yml`。
